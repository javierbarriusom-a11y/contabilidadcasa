const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");

// T6 (BACKLOG_CONTABILIDADCASA_2_0.md, Horizonte 4): memo de decisión ejecutivo de una página —
// recomendación, riesgos, sensibilidad y siguiente paso — para las tres decisiones grandes que ya
// tienen comparador propio (D4 refinanciar, LEV9 apalancarse, GOB15 vender vivienda). Sin motor
// nuevo: cada memo relee los mismos campos que su comparador. Mismo mecanismo de "PDF de una
// página" que GOB14 (#cierrePrintEvidence + window.print()).

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
  names.forEach((name) => vm.runInContext(extractFunction(name), context));
  return context;
}

function baseHelpers(extra = {}) {
  return {
    money: (value, precise) => `${Number(value || 0).toFixed(precise ? 2 : 0)} €`,
    escapeHtml: (value) => String(value ?? ""),
    parseAmount: (value) => (value === undefined || value === null || value === "" ? NaN : Number(value)),
    formatIsoDate: (value) => value,
    defaultBalanceDate: () => "2026-09-19",
    ...extra,
  };
}

// --- t6RefinanciarMemoContext ------------------------------------------------------------------

test("t6RefinanciarMemoContext · sin capital pendiente o sin umbral declarado, no hay memo (null)", () => {
  const context = sandboxWith(["t6RefinanciarMemoContext"], baseHelpers({
    deb4RadarSettings: () => ({ principal: 0, maxBreakEvenMonths: 12 }),
    window: { FinanceCanonicalMortgageRateScenarios: {} },
  }));
  assert.equal(context.t6RefinanciarMemoContext(), null);
});

test("t6RefinanciarMemoContext · punto de equilibrio no calculable, no hay memo (null)", () => {
  const context = sandboxWith(["t6RefinanciarMemoContext"], baseHelpers({
    deb4RadarSettings: () => ({ principal: 100000, months: 240, variableRate: 4, fixedRate: 3, refinancingCost: 1000, maxBreakEvenMonths: 12 }),
    window: {
      FinanceCanonicalMortgageRateScenarios: {
        evaluateMortgageRateScenarios: () => ({ scenarios: [{ id: "base", label: "Base" }] }),
        refinancingBreakEvenMonths: () => ({ calculable: false, months: null }),
      },
    },
  }));
  assert.equal(context.t6RefinanciarMemoContext(), null);
});

test("t6RefinanciarMemoContext · dentro del umbral, recomienda refinanciar y adjunta el guion como siguiente paso", () => {
  const context = sandboxWith(["t6RefinanciarMemoContext", "deb4RenegotiationScriptText"], baseHelpers({
    deb4RadarSettings: () => ({ principal: 100000, months: 240, variableRate: 4, fixedRate: 3, refinancingCost: 1000, maxBreakEvenMonths: 12 }),
    window: {
      FinanceCanonicalMortgageRateScenarios: {
        evaluateMortgageRateScenarios: () => ({
          scenarios: [
            { id: "base", label: "Base", variableRate: 4, variableMonthlyPayment: 600, fixedMonthlyPayment: 550, cheaper: "fixed" },
            { id: "favorable", label: "Favorable", variableRate: 3, variableMonthlyPayment: 550, fixedMonthlyPayment: 550, cheaper: "tie" },
            { id: "stress", label: "Tensión", variableRate: 5.5, variableMonthlyPayment: 650, fixedMonthlyPayment: 550, cheaper: "fixed" },
          ],
        }),
        refinancingBreakEvenMonths: () => ({ calculable: true, months: 6, cost: 1000 }),
      },
    },
  }));
  const result = context.t6RefinanciarMemoContext();
  assert.match(result.recommendation, /recupera su coste de cambio en 6 mes\(es\)/);
  assert.match(result.recommendation, /dentro de tu umbral de 12/);
  assert.equal(result.sensitivity.length, 3);
  assert.match(result.sensitivity[0], /Base:.*empate|más barato/);
  assert.match(result.nextStep, /Tengo un préstamo con capital pendiente/);
  assert.equal(result.risks.length, 2);
});

test("t6RefinanciarMemoContext · por encima del umbral, avisa que hoy no compensa y no ofrece guion", () => {
  const context = sandboxWith(["t6RefinanciarMemoContext", "deb4RenegotiationScriptText"], baseHelpers({
    deb4RadarSettings: () => ({ principal: 100000, months: 240, variableRate: 4, fixedRate: 3.9, refinancingCost: 5000, maxBreakEvenMonths: 6 }),
    window: {
      FinanceCanonicalMortgageRateScenarios: {
        evaluateMortgageRateScenarios: () => ({
          scenarios: [{ id: "base", label: "Base", variableRate: 4, variableMonthlyPayment: 600, fixedMonthlyPayment: 590, cheaper: "fixed" }],
        }),
        refinancingBreakEvenMonths: () => ({ calculable: true, months: 24, cost: 5000 }),
      },
    },
  }));
  const result = context.t6RefinanciarMemoContext();
  assert.match(result.recommendation, /por encima de tu umbral de 6: hoy no compensa/);
  assert.match(result.nextStep, /no hay guion que ofrecer/);
});

// --- t6ApalancarMemoContext --------------------------------------------------------------------

function lev9Engines(overrides = {}) {
  return {
    FinanceCanonicalLeverageCrossComparator: { crossInstrumentLeverageComparison: () => overrides.result },
    FinanceCanonicalLeverageSimulator: {},
    FinanceCanonicalEmergencyCreditLine: {},
    FinanceCanonicalPortfolio: { normalizePositions: () => ({ summary: { totalValue: 0 } }) },
    FinanceCanonicalLeverageBarrier: { evaluateLeverageBarrier: () => ({ valid: overrides.barrierValid !== false }) },
  };
}

test("t6ApalancarMemoContext · sin importe o meses declarados, no hay memo (null)", () => {
  const context = sandboxWith(["t6ApalancarMemoContext"], baseHelpers({
    qs: () => ({ value: "" }),
    iv1PositionsList: () => [],
    ap3LeverageBarrierInput: () => ({}),
    lev1PolicyResult: () => ({ calculable: false }),
    window: lev9Engines({}),
  }));
  assert.equal(context.t6ApalancarMemoContext(), null);
});

test("t6ApalancarMemoContext · con instrumento más barato, lo recomienda y añade guardarraíles no superados como riesgo", () => {
  const fields = { lev9Amount: "20000", lev9Months: "12" };
  const context = sandboxWith(["t6ApalancarMemoContext"], baseHelpers({
    qs: (id) => ({ value: fields[id] ?? "" }),
    iv1PositionsList: () => [],
    ap3LeverageBarrierInput: () => ({}),
    lev1PolicyResult: () => ({ calculable: true, withinLimit: false }),
    window: lev9Engines({
      result: {
        calculable: true,
        amount: 20000,
        months: 12,
        cheapestLabel: "Crédito Lombard",
        barrierValid: false,
        policyWithinLimit: false,
        instruments: [
          { id: "lombard", label: "Crédito Lombard", available: true, feasible: true, totalCost: 800 },
          { id: "mortgage", label: "Hipoteca", available: true, feasible: false, shortfall: 5000 },
        ],
        warning: "Comparación puntual, no ejecuta nada.",
      },
    }),
  }));
  const result = context.t6ApalancarMemoContext();
  assert.match(result.recommendation, /Usa Crédito Lombard/);
  assert.ok(result.risks.some((line) => /AP4/.test(line)));
  assert.ok(result.risks.some((line) => /LEV1/.test(line)));
  assert.ok(result.risks.some((line) => /Hipoteca no cubre el importe/.test(line)));
  assert.equal(result.sensitivity.length, 2);
  assert.deepEqual(Array.from(result.limitations), ["Comparación puntual, no ejecuta nada."]);
});

test("t6ApalancarMemoContext · sin guardarraíles bloqueando, deja un aviso genérico en vez de una lista vacía", () => {
  const fields = { lev9Amount: "5000", lev9Months: "6" };
  const context = sandboxWith(["t6ApalancarMemoContext"], baseHelpers({
    qs: (id) => ({ value: fields[id] ?? "" }),
    iv1PositionsList: () => [],
    ap3LeverageBarrierInput: () => ({}),
    lev1PolicyResult: () => ({ calculable: true, withinLimit: true }),
    window: lev9Engines({
      result: {
        calculable: true, amount: 5000, months: 6, cheapestLabel: "Línea de crédito",
        barrierValid: true, policyWithinLimit: true,
        instruments: [{ id: "creditLine", label: "Línea de crédito", available: true, feasible: true, totalCost: 100 }],
        warning: "",
      },
    }),
  }));
  const result = context.t6ApalancarMemoContext();
  assert.equal(result.risks.length, 1);
  assert.match(result.risks[0], /Ningún guardarraíl declarado bloquea/);
  assert.deepEqual(Array.from(result.limitations), []);
});

// --- t6VenderViviendaMemoContext ----------------------------------------------------------------

test("t6VenderViviendaMemoContext · sin precio de venta declarado, no hay memo (null)", () => {
  const context = sandboxWith(["t6VenderViviendaMemoContext"], baseHelpers({
    qs: () => ({ value: "" }),
    gob15SimulateSale: () => ({ calculable: false }),
    GOB15_EXEMPTION_NOTE: "nota",
  }));
  assert.equal(context.t6VenderViviendaMemoContext(), null);
});

test("t6VenderViviendaMemoContext · con venta calculable, resume neto, avisa del coste fiscal no calculable y dos líneas de sensibilidad", () => {
  const fields = { gob15SalePrice: "300000", gob15Mode: "alquiler" };
  const context = sandboxWith(["t6VenderViviendaMemoContext"], baseHelpers({
    qs: (id) => ({ value: fields[id] ?? "" }),
    gob15SimulateSale: () => ({
      calculable: true, mode: "alquiler",
      netProceeds: 150000, taxCalculable: false, oldMortgagePayment: 700, newMonthlyOutflow: 900,
      grossGain: 100000, exemptGain: 0, taxableGain: 100000, reinvestRatioPct: null, tax: 0,
      leftoverLiquidity: 150000, financedGap: 0, newMortgageCalculable: true,
    }),
    GOB15_EXEMPTION_NOTE: "Exención por reinversión...",
  }));
  const result = context.t6VenderViviendaMemoContext();
  assert.match(result.recommendation, /Neto libre tras gastos de venta, hipoteca cancelada: 150000\.00 €/);
  assert.match(result.recommendation, /pasa de 700\.00 € a un alquiler de 900\.00 €/);
  assert.ok(result.risks.some((line) => /coste fiscal de la plusvalía no se ha podido estimar/.test(line)));
  assert.equal(result.sensitivity.length, 2);
  assert.ok(result.limitations.includes("Exención por reinversión..."));
});

test("t6VenderViviendaMemoContext · sin bloqueos detectados, deja un aviso genérico en vez de una lista vacía", () => {
  const fields = { gob15SalePrice: "300000", gob15Mode: "alquiler" };
  const context = sandboxWith(["t6VenderViviendaMemoContext"], baseHelpers({
    qs: (id) => ({ value: fields[id] ?? "" }),
    gob15SimulateSale: () => ({
      calculable: true, mode: "alquiler",
      netProceeds: 150000, taxCalculable: true, oldMortgagePayment: 700, newMonthlyOutflow: 900, tax: 5000,
      grossGain: 100000, exemptGain: 0, taxableGain: 100000, reinvestRatioPct: null,
      leftoverLiquidity: 150000, financedGap: 0, newMortgageCalculable: true,
    }),
    GOB15_EXEMPTION_NOTE: "nota",
  }));
  const result = context.t6VenderViviendaMemoContext();
  assert.equal(result.risks.length, 1);
  assert.match(result.risks[0], /Sin bloqueos detectados/);
});

// --- t6DecisionMemoContext (despacho) ------------------------------------------------------------

test("t6DecisionMemoContext · despacha por kind al generador correcto, y a null para un kind desconocido", () => {
  const context = sandboxWith(["t6DecisionMemoContext"], baseHelpers({
    t6RefinanciarMemoContext: () => "refi",
    t6ApalancarMemoContext: () => "lev",
    t6VenderViviendaMemoContext: () => "gob15",
  }));
  assert.equal(context.t6DecisionMemoContext("refinanciar"), "refi");
  assert.equal(context.t6DecisionMemoContext("apalancar"), "lev");
  assert.equal(context.t6DecisionMemoContext("vender-vivienda"), "gob15");
  assert.equal(context.t6DecisionMemoContext("otra-cosa"), null);
});

// --- t6DecisionMemoPrintHtml ---------------------------------------------------------------------

test("t6DecisionMemoPrintHtml · pinta recomendación, riesgos, sensibilidad, siguiente paso y límites", () => {
  const context = sandboxWith(["t6DecisionMemoPrintHtml"], baseHelpers({
    T6_MEMO_KIND_LABEL: { refinanciar: "Refinanciar la hipoteca (D4)" },
  }));
  const html = context.t6DecisionMemoPrintHtml("refinanciar", {
    recommendation: "Refinanciar compensa.",
    risks: ["Riesgo uno."],
    sensitivity: ["Escenario base."],
    nextStep: "Llama al banco.",
    limitations: ["No es asesoría profesional."],
  });
  assert.match(html, /<h1>Memo de decisión — Refinanciar la hipoteca \(D4\)<\/h1>/);
  assert.match(html, /Refinanciar compensa\./);
  assert.match(html, /Riesgo uno\./);
  assert.match(html, /Escenario base\./);
  assert.match(html, /Llama al banco\./);
  assert.match(html, /No es asesoría profesional\./);
});

test("t6DecisionMemoPrintHtml · sin límites que declarar, omite la sección en vez de un hueco vacío", () => {
  const context = sandboxWith(["t6DecisionMemoPrintHtml"], baseHelpers({
    T6_MEMO_KIND_LABEL: {},
  }));
  const html = context.t6DecisionMemoPrintHtml("apalancar", {
    recommendation: "x", risks: [], sensitivity: [], nextStep: "y", limitations: [],
  });
  assert.doesNotMatch(html, /Límites de este cálculo/);
  assert.match(html, /Ninguno\./);
});

// --- downloadT6DecisionMemo -----------------------------------------------------------------------

test("downloadT6DecisionMemo · con memo calculable, pinta el contenedor compartido e imprime", () => {
  const printCalls = [];
  const bodyClasses = new Set();
  const container = { innerHTML: "" };
  const note = { textContent: "" };
  const context = sandboxWith(["downloadT6DecisionMemo", "t6DecisionMemoContext", "t6DecisionMemoPrintHtml"], baseHelpers({
    T6_MEMO_KIND_LABEL: { refinanciar: "Refinanciar la hipoteca (D4)" },
    T6_MEMO_MISSING_DATA_TEXT: "Faltan datos.",
    t6RefinanciarMemoContext: () => ({ recommendation: "ok", risks: [], sensitivity: [], nextStep: "paso", limitations: [] }),
    t6ApalancarMemoContext: () => null,
    t6VenderViviendaMemoContext: () => null,
    qs: (id) => (id === "cierrePrintEvidence" ? container : id === "noteId" ? note : null),
    document: { body: { classList: { add: (cls) => bodyClasses.add(cls), remove: (cls) => bodyClasses.delete(cls) } } },
    window: { print: () => printCalls.push(true) },
  }));
  context.downloadT6DecisionMemo("refinanciar", "noteId");
  assert.equal(printCalls.length, 1);
  assert.match(container.innerHTML, /Memo de decisión/);
  assert.equal(bodyClasses.has("is-printing-cierre-evidence"), false);
  assert.equal(note.textContent, "");
});

test("downloadT6DecisionMemo · sin datos suficientes, avisa en la nota y no llama a print", () => {
  const printCalls = [];
  const note = { textContent: "" };
  const container = { innerHTML: "" };
  const context = sandboxWith(["downloadT6DecisionMemo", "t6DecisionMemoContext", "t6DecisionMemoPrintHtml"], baseHelpers({
    T6_MEMO_KIND_LABEL: {},
    T6_MEMO_MISSING_DATA_TEXT: "Faltan datos declarados arriba para generar el memo — complétalos y vuelve a intentarlo.",
    t6RefinanciarMemoContext: () => null,
    t6ApalancarMemoContext: () => null,
    t6VenderViviendaMemoContext: () => null,
    qs: (id) => (id === "cierrePrintEvidence" ? container : id === "noteId" ? note : null),
    document: { body: { classList: { add: () => {}, remove: () => {} } } },
    window: { print: () => printCalls.push(true) },
  }));
  context.downloadT6DecisionMemo("refinanciar", "noteId");
  assert.equal(printCalls.length, 0);
  assert.equal(note.textContent, "Faltan datos declarados arriba para generar el memo — complétalos y vuelve a intentarlo.");
});

// --- wiring ----------------------------------------------------------------------------------

test("wiring: app.js conecta los tres botones de memo con downloadT6DecisionMemo", () => {
  assert.match(app, /qs\("t6MemoRefinanciar"\)\?\.addEventListener\("click", \(\) => downloadT6DecisionMemo\("refinanciar", "t6MemoRefinanciarNote"\)\);/);
  assert.match(app, /qs\("t6MemoApalancar"\)\?\.addEventListener\("click", \(\) => downloadT6DecisionMemo\("apalancar", "t6MemoApalancarNote"\)\);/);
  assert.match(app, /qs\("t6MemoVenderVivienda"\)\?\.addEventListener\("click", \(\) => downloadT6DecisionMemo\("vender-vivienda", "t6MemoVenderViviendaNote"\)\);/);
});

test("wiring: index.html declara los tres botones de memo, cada uno junto a su comparador", () => {
  assert.match(indexHtml, /id="t6MemoRefinanciar"/);
  assert.match(indexHtml, /id="t6MemoApalancar"/);
  assert.match(indexHtml, /id="t6MemoVenderVivienda"/);
  const deb4Idx = indexHtml.indexOf('id="deb4RadarAlert"');
  const memoRefiIdx = indexHtml.indexOf('id="t6MemoRefinanciar"');
  assert.ok(deb4Idx > 0 && memoRefiIdx > deb4Idx && memoRefiIdx - deb4Idx < 400, "El botón de refinanciar debe vivir junto al radar de D4");
  const lev9Idx = indexHtml.indexOf('id="lev9ComparisonNote"');
  const memoLevIdx = indexHtml.indexOf('id="t6MemoApalancar"');
  assert.ok(lev9Idx > 0 && memoLevIdx > lev9Idx && memoLevIdx - lev9Idx < 200, "El botón de apalancar debe vivir junto al comparador de LEV9");
  const gob15Idx = indexHtml.indexOf('id="gob15SimulationNote"');
  const memoGob15Idx = indexHtml.indexOf('id="t6MemoVenderVivienda"');
  assert.ok(gob15Idx > 0 && memoGob15Idx > gob15Idx && memoGob15Idx - gob15Idx < 200, "El botón de vender vivienda debe vivir junto al simulador de GOB15");
});
