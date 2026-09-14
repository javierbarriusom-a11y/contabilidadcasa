const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const html = read("index.html");
const IrpfEstimator = require("../canonical-irpf-estimator.js");
const Assets = require("../canonical-assets.js");
const MortgageScenarios = require("../canonical-mortgage-rate-scenarios.js");

// GOB15 (Oleada 4, Bloque 7, apuesta L reservada a sesión propia): simulador de vender la vivienda
// habitual, con dos destinos para el neto — alquiler o comprar una vivienda nueva (decisión del hogar,
// sesión 190, de incluir el segundo destino). Cancela la hipoteca activa ya declarada en Deuda ›
// Contratos, estima el coste fiscal de la plusvalía (con exención proporcional por reinversión si
// compra, art. 38 LIRPF) y compara la cuota mensual actual contra el destino elegido. Sin motor propio
// salvo esa fórmula de exención proporcional: reutiliza optimizePartialSale (FC5), monthlyPayment
// (DI1) y rentalAssetPnL (INV9) tal cual.

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
  const match = new RegExp(`const ${name} = "([^"]*)";`).exec(app);
  assert.ok(match, `No existe la constante ${name} en app.js`);
  return `const ${name} = ${JSON.stringify(match[1])};`;
}

const SAVINGS_SCALE = {
  brackets: [{ limit: 6000, rate: 19 }, { limit: 50000, rate: 21 }, { limit: null, rate: 23 }],
  source: { title: "Agencia Tributaria", authority: "Declarado por el hogar", url: "https://sede.agenciatributaria.gob.es/x", checkedAt: "2026-01-01" },
};

function mortgageContractRow(overrides = {}) {
  return { id: "m1", entity: "Banco", type: "Hipoteca", number: "h1", paymentStatus: "active", currentPrincipal: 150000, currentPayment: 700, ...overrides };
}

function sandboxWith(names, extra = {}) {
  const context = {
    escapeHtml: (v) => String(v ?? ""),
    money: (v) => `${Number(v || 0).toFixed(2)}€`,
    parseAmount: (value) => {
      const raw = String(value ?? "").trim();
      if (!raw) return null;
      const parsed = Number(raw.replace(",", "."));
      return Number.isFinite(parsed) ? parsed : null;
    },
    round2: (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100,
    sumRows: (rows, getValue) => rows.reduce((sum, row) => sum + getValue(row), 0),
    window: {
      FinanceCanonicalIrpfEstimator: IrpfEstimator,
      FinanceCanonicalAssets: Assets,
      FinanceCanonicalMortgageRateScenarios: MortgageScenarios,
    },
    latestIrpfScale: () => SAVINGS_SCALE,
    debtContractSourceRows: () => [mortgageContractRow()],
    ...extra,
  };
  vm.createContext(context);
  vm.runInContext(extractConst("GOB15_EXEMPTION_NOTE"), context);
  vm.runInContext(extractFunction("deb14MortgageContracts"), context);
  names.forEach((name) => vm.runInContext(extractFunction(name), context));
  return context;
}

// --- gob15OldMortgage --------------------------------------------------------------------------

test("gob15OldMortgage · suma capital y cuota de los contratos activos de tipo hipoteca, ignora el resto", () => {
  const ctx = sandboxWith(["gob15OldMortgage"], {
    debtContractSourceRows: () => [
      mortgageContractRow({ id: "m1", currentPrincipal: 100000, currentPayment: 500 }),
      mortgageContractRow({ id: "m2", currentPrincipal: 50000, currentPayment: 200 }),
      mortgageContractRow({ id: "c1", type: "Crédito", currentPrincipal: 5000, currentPayment: 100 }),
      mortgageContractRow({ id: "m3", paymentStatus: "settled", currentPrincipal: 9999, currentPayment: 999 }),
    ],
  });
  const result = ctx.gob15OldMortgage();
  assert.equal(result.principal, 150000);
  assert.equal(result.monthlyPayment, 700);
});

test("gob15OldMortgage · sin hipoteca activa declarada, cae a 0 (se asume ya liquidada)", () => {
  const ctx = sandboxWith(["gob15OldMortgage"], { debtContractSourceRows: () => [] });
  const result = ctx.gob15OldMortgage();
  assert.equal(result.principal, 0);
  assert.equal(result.monthlyPayment, 0);
});

// --- gob15SimulateSale · modo alquiler -----------------------------------------------------------

test("gob15SimulateSale · alquiler: plusvalía íntegra tributa (mismo motor que FC5), neto y cambio de cuota correctos", () => {
  const ctx = sandboxWith(["gob15OldMortgage", "gob15SimulateSale"]);
  const result = ctx.gob15SimulateSale({
    mode: "alquiler", salePrice: 300000, acquisitionCost: 200000, sellingCosts: 15000,
    newMonthlyRent: 900, alreadyRealizedGain: 0,
  });
  assert.equal(result.grossGain, 100000);
  assert.equal(result.exemptGain, 0);
  assert.equal(result.taxableGain, 100000);
  assert.equal(result.tax, 21880); // 6000*19% + 44000*21% + 50000*23%
  assert.equal(result.taxCalculable, true);
  assert.equal(result.oldMortgagePrincipal, 150000);
  assert.equal(result.netProceeds, 113120); // 300000-15000-150000-21880
  assert.equal(result.newAnnualRent, 10800);
  assert.equal(result.leftoverLiquidity, 113120);
  assert.equal(result.monthlyChange, -200); // 700 (hipoteca) - 900 (alquiler)
});

test("gob15SimulateSale · exención declarada manualmente anula el impuesto, sin importar el modo", () => {
  const ctx = sandboxWith(["gob15OldMortgage", "gob15SimulateSale"]);
  const result = ctx.gob15SimulateSale({
    mode: "alquiler", salePrice: 300000, acquisitionCost: 200000, sellingCosts: 15000,
    manualExemption: true, newMonthlyRent: 900, alreadyRealizedGain: 0,
  });
  assert.equal(result.exemptGain, 100000);
  assert.equal(result.taxableGain, 0);
  assert.equal(result.tax, 0);
  assert.equal(result.netProceeds, 135000); // 300000-15000-150000-0
});

test("gob15SimulateSale · sin escala del tramo del ahorro registrada, el coste fiscal no es calculable (nunca 0 fabricado)", () => {
  const ctx = sandboxWith(["gob15OldMortgage", "gob15SimulateSale"], { latestIrpfScale: () => null });
  const result = ctx.gob15SimulateSale({ mode: "alquiler", salePrice: 300000, acquisitionCost: 200000, sellingCosts: 15000, newMonthlyRent: 900 });
  assert.equal(result.taxCalculable, false);
  assert.equal(result.netProceeds, 135000); // no descuenta impuesto no calculable
});

// --- gob15SimulateSale · modo compra --------------------------------------------------------------

test("gob15SimulateSale · compra: exención proporcional al importe reinvertido (art. 38 LIRPF)", () => {
  const ctx = sandboxWith(["gob15OldMortgage", "gob15SimulateSale"]);
  const result = ctx.gob15SimulateSale({
    mode: "compra", salePrice: 300000, acquisitionCost: 200000, sellingCosts: 15000,
    newHomePrice: 250000, reinvestedAmount: 150000, alreadyRealizedGain: 0,
  });
  assert.equal(result.reinvestRatioPct, 50);
  assert.equal(result.exemptGain, 50000);
  assert.equal(result.taxableGain, 50000);
  assert.equal(result.tax, 10380); // 6000*19% + 44000*21%
});

test("gob15SimulateSale · compra: reinvertir el precio de venta entero exime toda la ganancia", () => {
  const ctx = sandboxWith(["gob15OldMortgage", "gob15SimulateSale"]);
  const result = ctx.gob15SimulateSale({
    mode: "compra", salePrice: 300000, acquisitionCost: 200000, sellingCosts: 15000,
    newHomePrice: 300000, reinvestedAmount: 300000,
  });
  assert.equal(result.reinvestRatioPct, 100);
  assert.equal(result.exemptGain, 100000);
  assert.equal(result.taxableGain, 0);
});

test("gob15SimulateSale · compra: la hipoteca nueva usa el mismo monthlyPayment que DI1, sobre el importe no cubierto", () => {
  const ctx = sandboxWith(["gob15OldMortgage", "gob15SimulateSale"]);
  const result = ctx.gob15SimulateSale({
    mode: "compra", salePrice: 300000, acquisitionCost: 200000, sellingCosts: 15000,
    newHomePrice: 250000, reinvestedAmount: 150000, newMortgageRatePct: 3, newMortgageMonths: 300,
  });
  const expectedPayment = MortgageScenarios.monthlyPayment(100000, 3, 300);
  assert.equal(result.financedGap, 100000);
  assert.equal(result.newMortgageCalculable, true);
  assert.equal(result.newMonthlyOutflow, expectedPayment);
});

test("gob15SimulateSale · compra: importe pendiente de financiar sin TIN/plazo declarados, no calcula una cuota inventada", () => {
  const ctx = sandboxWith(["gob15OldMortgage", "gob15SimulateSale"]);
  const result = ctx.gob15SimulateSale({
    mode: "compra", salePrice: 300000, acquisitionCost: 200000, sellingCosts: 15000,
    newHomePrice: 250000, reinvestedAmount: 150000,
  });
  assert.equal(result.newMortgageCalculable, false);
  assert.equal(result.newMonthlyOutflow, 0);
});

test("gob15SimulateSale · compra: reinversión cubre el precio entero, sin hipoteca nueva", () => {
  const ctx = sandboxWith(["gob15OldMortgage", "gob15SimulateSale"]);
  const result = ctx.gob15SimulateSale({
    mode: "compra", salePrice: 300000, acquisitionCost: 200000, sellingCosts: 15000,
    newHomePrice: 200000, reinvestedAmount: 250000,
  });
  assert.equal(result.financedGap, 0);
  assert.equal(result.newMonthlyOutflow, 0);
  assert.equal(result.newMortgageCalculable, true);
});

test("gob15SimulateSale · compra: reinvertir más del neto disponible se avisa como liquidez negativa, nunca se oculta", () => {
  const ctx = sandboxWith(["gob15OldMortgage", "gob15SimulateSale"]);
  const result = ctx.gob15SimulateSale({
    mode: "compra", salePrice: 300000, acquisitionCost: 200000, sellingCosts: 15000,
    newHomePrice: 250000, reinvestedAmount: 150000, newMortgageRatePct: 3, newMortgageMonths: 300,
  });
  assert.equal(result.leftoverLiquidity, result.netProceeds - 150000);
  assert.ok(result.leftoverLiquidity < 0);
});

// --- gob15ResultHtml -------------------------------------------------------------------------------

test("gob15ResultHtml · modo alquiler: cita el alquiler anualizado (rentalAssetPnL, INV9) y el cambio de cuota", () => {
  const ctx = sandboxWith(["gob15OldMortgage", "gob15SimulateSale", "gob15ResultHtml"]);
  const result = ctx.gob15SimulateSale({ mode: "alquiler", salePrice: 300000, acquisitionCost: 200000, sellingCosts: 15000, newMonthlyRent: 900 });
  const htmlOut = ctx.gob15ResultHtml(result);
  assert.match(htmlOut, /10800.00€\/año/);
  assert.match(htmlOut, /sube 200.00€\/mes/);
});

test("gob15ResultHtml · modo compra: cita el % reinvertido y la nota de exención por reinversión", () => {
  const ctx = sandboxWith(["gob15OldMortgage", "gob15SimulateSale", "gob15ResultHtml"]);
  const result = ctx.gob15SimulateSale({
    mode: "compra", salePrice: 300000, acquisitionCost: 200000, sellingCosts: 15000,
    newHomePrice: 250000, reinvestedAmount: 150000,
  });
  const htmlOut = ctx.gob15ResultHtml(result);
  assert.match(htmlOut, /Reinviertes el 50%/);
  assert.match(htmlOut, /art\. 38 LIRPF/);
  assert.match(htmlOut, /declara TIN y plazo/);
});

test("gob15ResultHtml · sin escala fiscal registrada, remite a Fiscal › IRPF en vez de fingir un coste", () => {
  const ctx = sandboxWith(["gob15OldMortgage", "gob15SimulateSale", "gob15ResultHtml"], { latestIrpfScale: () => null });
  const result = ctx.gob15SimulateSale({ mode: "alquiler", salePrice: 300000, acquisitionCost: 200000, sellingCosts: 15000, newMonthlyRent: 900 });
  const htmlOut = ctx.gob15ResultHtml(result);
  assert.match(htmlOut, /Registra la escala del tramo del ahorro en Fiscal › IRPF/);
});

// --- handleGob15Simulate ----------------------------------------------------------------------------

function noteSandbox(values = {}) {
  const note = { innerHTML: "" };
  const fields = { gob15Mode: "alquiler", gob15SalePrice: "", gob15AcquisitionCost: "", gob15SellingCosts: "", gob15NewMonthlyRent: "", gob15NewHomePrice: "", gob15ReinvestedAmount: "", gob15NewMortgageRatePct: "", gob15NewMortgageMonths: "", fc5AlreadyRealized: "", ...values };
  const ctx = sandboxWith(["gob15OldMortgage", "gob15SimulateSale", "gob15ResultHtml", "handleGob15Simulate"], {
    qs: (id) => {
      if (id === "gob15SimulationNote") return note;
      if (id === "gob15ManualExemption") return { checked: false };
      if (id in fields) return { value: fields[id] };
      return null;
    },
  });
  return { ctx, note };
}

test("handleGob15Simulate · sin precio de venta, pide el dato antes de simular", () => {
  const { ctx, note } = noteSandbox();
  ctx.handleGob15Simulate();
  assert.match(note.innerHTML, /Indica al menos el precio de venta/);
});

test("handleGob15Simulate · con los campos declarados, simula y escribe el resultado en la nota", () => {
  const { ctx, note } = noteSandbox({ gob15SalePrice: "300000", gob15AcquisitionCost: "200000", gob15SellingCosts: "15000", gob15NewMonthlyRent: "900" });
  ctx.handleGob15Simulate();
  assert.match(note.innerHTML, /113120.00€/);
});

test("no persiste nada en scenarioSettings: es una calculadora puntual, como DI1/AP3", () => {
  const body = extractFunction("handleGob15Simulate");
  assert.doesNotMatch(body, /saveScenarioSettings/);
});

// --- syncGob15ModeFields -----------------------------------------------------------------------------

test("syncGob15ModeFields · alquiler muestra los campos de alquiler y oculta los de compra", () => {
  const rent = { hasAttribute: () => false, toggleAttribute(_, force) { this.hidden = force; } };
  const buy = { hasAttribute: () => false, toggleAttribute(_, force) { this.hidden = force; } };
  const ctx = sandboxWith(["syncGob15ModeFields"], {
    qs: (id) => (id === "gob15Mode" ? { value: "alquiler" } : id === "gob15RentFields" ? rent : id === "gob15BuyFields" ? buy : null),
  });
  ctx.syncGob15ModeFields();
  assert.equal(rent.hidden, false);
  assert.equal(buy.hidden, true);
});

test("syncGob15ModeFields · compra muestra los campos de compra y oculta los de alquiler", () => {
  const rent = { hasAttribute: () => false, toggleAttribute(_, force) { this.hidden = force; } };
  const buy = { hasAttribute: () => false, toggleAttribute(_, force) { this.hidden = force; } };
  const ctx = sandboxWith(["syncGob15ModeFields"], {
    qs: (id) => (id === "gob15Mode" ? { value: "compra" } : id === "gob15RentFields" ? rent : id === "gob15BuyFields" ? buy : null),
  });
  ctx.syncGob15ModeFields();
  assert.equal(rent.hidden, true);
  assert.equal(buy.hidden, false);
});

// --- wiring --------------------------------------------------------------------------------------

test("wiring: la tarjeta vive en #herramientas-patrimonio, justo después de GOB11, con sus campos", () => {
  const openTag = /<section[^>]*id="herramientas-patrimonio"[^>]*>/.exec(html);
  assert.ok(openTag, "No existe la sección #herramientas-patrimonio");
  const start = openTag.index + openTag[0].length;
  const end = html.indexOf("</section>", start);
  const section = html.slice(start, end);
  const gob11Idx = section.indexOf("Proyección de jubilación unificada");
  const gob15Idx = section.indexOf("Vender la vivienda habitual: alquiler o compra");
  assert.ok(gob11Idx >= 0 && gob15Idx > gob11Idx, "GOB15 debe ir después de GOB11");
  ["gob15Mode", "gob15SalePrice", "gob15AcquisitionCost", "gob15SellingCosts", "gob15ManualExemption",
    "gob15RentFields", "gob15NewMonthlyRent", "gob15BuyFields", "gob15NewHomePrice", "gob15ReinvestedAmount",
    "gob15NewMortgageRatePct", "gob15NewMortgageMonths", "gob15Simulate", "gob15SimulationNote",
  ].forEach((id) => assert.match(section, new RegExp(`id="${id}"`), `Falta #${id}`));
});

test("wiring: los controles están cableados y el botón tiene ayuda contextual", () => {
  assert.match(app, /qs\("gob15Mode"\)\?\.addEventListener\("change", syncGob15ModeFields\)/);
  assert.match(app, /qs\("gob15Simulate"\)\?\.addEventListener\("click", handleGob15Simulate\)/);
  assert.match(app, /qs\("gob15Simulate"\)\?\.setAttribute\("data-help"/);
});

test("wiring: syncGob15ModeFields se llama en el arranque de la app, para que el modo por defecto oculte los campos de compra", () => {
  assert.match(app, /renderGob11Panel\(\);\s*\n\s*syncGob15ModeFields\(\);/);
});
