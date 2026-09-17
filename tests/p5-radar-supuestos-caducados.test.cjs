const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const html = read("index.html");
const forecast = require("../canonical-forecast.js");

// P5 (Horizonte 1, sesión 199): radar único de supuestos caducados con «revisar ahora». Agrega lo
// que assumptionExpiryAlerts (PVC15) ya calculaba, hasta ahora solo visible marcado uno a uno
// dentro de la lista completa del registro de supuestos (Ajustes). Sin motor nuevo.

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
  const start = app.indexOf(`const ${name} =`);
  assert.ok(start >= 0, `No existe la constante ${name} en app.js`);
  const end = app.indexOf("\n};", start);
  assert.ok(end >= 0, `No se encontró el cierre de ${name}`);
  return app.slice(start, end + 3);
}

function sandboxWith(names, extra = {}) {
  const context = { escapeHtml: (v) => String(v ?? ""), ...extra };
  vm.createContext(context);
  vm.runInContext(extractConst("ASSUMPTION_EXPIRY_REVIEW_TARGETS"), context);
  names.forEach((name) => vm.runInContext(extractFunction(name), context));
  return context;
}

// --- ASSUMPTION_EXPIRY_REVIEW_TARGETS cubre exactamente los mismos ids que tienen umbral --------

test("ASSUMPTION_EXPIRY_REVIEW_TARGETS cubre exactamente los ids con umbral de caducidad (ASSUMPTION_EXPIRY_MONTHS_DEFAULT)", () => {
  const context = { escapeHtml: (v) => String(v ?? "") };
  vm.createContext(context);
  const targets = vm.runInContext(`${extractConst("ASSUMPTION_EXPIRY_REVIEW_TARGETS")}\nASSUMPTION_EXPIRY_REVIEW_TARGETS;`, context);
  const targetIds = Object.keys(targets).sort();
  const thresholdIds = Object.keys(forecast.ASSUMPTION_EXPIRY_MONTHS_DEFAULT).sort();
  assert.deepEqual(targetIds, thresholdIds);
});

// --- assumptionExpiryReviewButtonHtml -----------------------------------------------------------

test("assumptionExpiryReviewButtonHtml · un supuesto fiscal enfoca su propio campo en la misma tarjeta (data-scroll-focus)", () => {
  const context = sandboxWith(["assumptionExpiryReviewButtonHtml"]);
  const html = context.assumptionExpiryReviewButtonHtml("fiscalWithholdingRate");
  assert.match(html, /data-scroll-focus="ajustesFiscalWithholdingRateField"/);
  assert.match(html, />Revisar ahora</);
  assert.doesNotMatch(html, /data-home-nav/);
});

test("assumptionExpiryReviewButtonHtml · un supuesto general del forecast navega al Laboratorio de escenarios (data-home-nav)", () => {
  const context = sandboxWith(["assumptionExpiryReviewButtonHtml"]);
  const html = context.assumptionExpiryReviewButtonHtml("annualIncomeGrowth");
  assert.match(html, /data-home-nav="simulator"/);
  assert.doesNotMatch(html, /data-scroll-focus/);
});

test("assumptionExpiryReviewButtonHtml · un id sin destino conocido no rompe, no pinta botón", () => {
  const context = sandboxWith(["assumptionExpiryReviewButtonHtml"]);
  assert.equal(context.assumptionExpiryReviewButtonHtml("openingChecking"), "");
});

// --- renderAjustesAssumptionExpiryRadar ---------------------------------------------------------

function radarSandbox() {
  const elements = {
    ajustesAssumptionExpiryRadar: { hidden: false },
    ajustesAssumptionExpiryRadarList: { innerHTML: "" },
  };
  const context = sandboxWith(["renderAjustesAssumptionExpiryRadar", "assumptionExpiryReviewButtonHtml"], {
    qs: (id) => elements[id] || null,
  });
  return { context, elements };
}

test("renderAjustesAssumptionExpiryRadar · sin caducados, oculta la tarjeta", () => {
  const { context, elements } = radarSandbox();
  context.renderAjustesAssumptionExpiryRadar({ expired: [] });
  assert.equal(elements.ajustesAssumptionExpiryRadar.hidden, true);
  context.renderAjustesAssumptionExpiryRadar(null);
  assert.equal(elements.ajustesAssumptionExpiryRadar.hidden, true);
});

test("renderAjustesAssumptionExpiryRadar · con caducados, muestra la tarjeta con la etiqueta, la antigüedad y el botón de revisión", () => {
  const { context, elements } = radarSandbox();
  context.renderAjustesAssumptionExpiryRadar({
    expired: [
      { id: "fiscalWithholdingRate", label: "Retenciones aplicadas", ageMonths: 14, thresholdMonths: 12 },
      { id: "annualIncomeGrowth", label: "Crecimiento anual de ingresos", ageMonths: 8, thresholdMonths: 6 },
    ],
  });
  assert.equal(elements.ajustesAssumptionExpiryRadar.hidden, false);
  const listHtml = elements.ajustesAssumptionExpiryRadarList.innerHTML;
  assert.match(listHtml, /Retenciones aplicadas/);
  assert.match(listHtml, /14 meses \(más de 12\)/);
  assert.match(listHtml, /data-scroll-focus="ajustesFiscalWithholdingRateField"/);
  assert.match(listHtml, /Crecimiento anual de ingresos/);
  assert.match(listHtml, /data-home-nav="simulator"/);
});

// --- Cableado en renderAjustesAssumptionRegistry() y en el documento ----------------------------

test("renderAjustesAssumptionRegistry llama a renderAjustesAssumptionExpiryRadar con el mismo resultado de assumptionExpiryAlerts", () => {
  const source = extractFunction("renderAjustesAssumptionRegistry");
  assert.match(source, /const expiry = engine\.assumptionExpiryAlerts/);
  assert.match(source, /renderAjustesAssumptionExpiryRadar\(expiry\);/);
});

test("la tarjeta del radar vive en Ajustes, antes del registro completo, oculta por defecto", () => {
  const radarIndex = html.indexOf('id="ajustesAssumptionExpiryRadar"');
  const registryIndex = html.indexOf('id="ajustesAssumptionRegistry"');
  assert.ok(radarIndex >= 0, "No existe #ajustesAssumptionExpiryRadar en index.html");
  assert.ok(registryIndex > radarIndex, "El radar debería vivir antes de la lista completa del registro");
  const cardTag = /<article[^>]*id="ajustesAssumptionExpiryRadar"[^>]*>/.exec(html);
  assert.match(cardTag[0], /hidden/);
  assert.match(html, /id="ajustesAssumptionExpiryRadarList"/);
});

test("los cinco campos fiscales tienen el contenedor con id que usa data-scroll-focus", () => {
  ["ajustesFiscalJointTaxationField", "ajustesFiscalWithholdingRateField", "ajustesFiscalDeductibleContributionsField", "ajustesFiscalDeductibleRentField", "ajustesFiscalLargeFamilyField"].forEach((id) => {
    assert.match(html, new RegExp(`id="${id}"`), `Falta #${id} en index.html`);
  });
});
