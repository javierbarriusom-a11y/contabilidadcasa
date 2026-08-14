const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const html = read("index.html");
const css = read("design-tokens.css");
const worker = read("service-worker.js");

// V3-4 · «Oferta en curso» del mockup 4d vivía solo en #asesor-decision. Esta tarjeta la trae a la
// propia vista de Deuda (#deuda-ruta), reutilizando asesorDecisionOpenOffers() y
// asesorDecisionFundingHtml() tal cual, sin recalcular nada. El botón replica el mismo gesto que
// asesorDecisionApply: marca la oferta en el workspace de E14b y enruta a #debt-roadmap, que sigue
// siendo el único sitio donde se registra y aplica una oferta de verdad. Cierra la vista 3 · Deuda
// por completo.

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

function field() {
  return { innerHTML: "", onclick: null };
}

function sandbox({ offer = null, contract = null, funding = "<funding-html>" } = {}) {
  const target = field();
  const link = field();
  const calls = { queueRemoteSave: 0, workspace: { selectedOfferId: null } };
  const elements = new Map([
    ["deudaRutaOffer", target],
    ["deudaRutaOfferApply", link],
  ]);
  const context = {
    qs: (id) => elements.get(id) || null,
    escapeHtml: (value) => String(value ?? ""),
    money: (value) => `${Number(value).toFixed(2)} €`,
    escenarioMotorMonthLabel: (value) => `etiqueta:${value}`,
    asesorDecisionOpenOffers: () => (offer ? [offer] : []),
    asesorDecisionFundingHtml: () => funding,
    debtTargetById: () => contract,
    e14bWorkspace: () => calls.workspace,
    queueRemoteSave: () => { calls.queueRemoteSave += 1; },
    calls,
    target,
    link,
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("renderDeudaRutaOffer"), context);
  context.renderDeudaRutaOffer();
  return context;
}

test("V3-4 · sin ofertas abiertas, la tarjeta lo dice en vez de dejarse en blanco", () => {
  const { target } = sandbox({ offer: null });
  assert.match(target.innerHTML, /Sin ofertas de deuda abiertas/);
});

test("V3-4 · con una oferta, la tarjeta enseña contraparte, importe, ahorro y cobertura", () => {
  const offer = { id: "offer-1", counterpart: "Cetelem", amount: 4200, discount: 180, expiresAt: "2026-09", contractId: "c1" };
  const { target } = sandbox({ offer, funding: "<div>cobertura</div>" });
  assert.match(target.innerHTML, /Cetelem/);
  assert.match(target.innerHTML, /4200\.00 €/);
  assert.match(target.innerHTML, /180\.00 €/);
  assert.match(target.innerHTML, /etiqueta:2026-09/);
  assert.match(target.innerHTML, /<div>cobertura<\/div>/);
});

test("V3-4 · con contrato, nombra la entidad; sin contraparte ni contrato, no inventa nada", () => {
  const offer = { id: "offer-1", amount: 100, discount: 0, contractId: "c1" };
  const contract = { entity: "Cetelem", type: "Préstamo personal" };
  const conContrato = sandbox({ offer, contract }).target.innerHTML;
  assert.match(conContrato, /Cetelem/);
  assert.match(conContrato, /Préstamo personal/);

  const sinNada = sandbox({ offer: { id: "offer-1", amount: 100, discount: 0 }, contract: null }).target.innerHTML;
  assert.match(sinNada, /Sin contraparte/);
  assert.ok(!/undefined/.test(sinNada), "no debe filtrar un undefined al HTML");
});

test("V3-4 · el botón replica el gesto de asesorDecisionApply: marca la oferta y encola el guardado", () => {
  const offer = { id: "offer-1", counterpart: "Cetelem", amount: 100, discount: 0 };
  const { link, calls } = sandbox({ offer });
  assert.equal(typeof link.onclick, "function");
  link.onclick();
  assert.equal(calls.workspace.selectedOfferId, "offer-1");
  assert.equal(calls.queueRemoteSave, 1);
});

test("V3-4 · el botón enruta a #debt-roadmap, el único sitio donde se aplica de verdad una oferta", () => {
  const offer = { id: "offer-1", counterpart: "Cetelem", amount: 100, discount: 0 };
  const { target } = sandbox({ offer });
  assert.match(target.innerHTML, /id="deudaRutaOfferApply" href="#debt-roadmap"/);
});

test("V3-4 · reutiliza asesorDecisionOpenOffers y asesorDecisionFundingHtml tal cual, sin recalcular nada", () => {
  const fn = extractFunction("renderDeudaRutaOffer");
  assert.match(fn, /asesorDecisionOpenOffers\(\)\[0\]/);
  assert.match(fn, /asesorDecisionFundingHtml\(offer\.amount\)/);
});

test("V3-4 · Deuda pinta la tarjeta al renderizar la ruta", () => {
  const render = extractFunction("renderDeudaRuta");
  assert.match(render, /renderDeudaRutaOffer\(\);/);
});

test("V3-4 · la tarjeta vive en #deuda-ruta, dentro de la misma columna que Cartera y Antes de aplicar", () => {
  const sectionStart = html.indexOf('id="deuda-ruta"');
  const sectionEnd = html.indexOf("</section>", sectionStart);
  const section = html.slice(sectionStart, sectionEnd);
  assert.match(section, /id="deudaRutaOffer"/);
  const offerIndex = section.indexOf('id="deudaRutaOffer"');
  const portfolioIndex = section.indexOf('id="deudaRutaPortfolio"');
  const applyIndex = section.indexOf('id="deudaRutaApply"');
  assert.ok(offerIndex < portfolioIndex && portfolioIndex < applyIndex, "Oferta en curso va antes que Cartera y Antes de aplicar");
});

test("V3-4 · el CSS de la tarjeta se reutiliza de asesor-decision, sin declarar colores nuevos", () => {
  assert.match(css, /\.e19-asesor-decision \.asesor-decision-funding,\s*\n\.e19-deuda-decidir \.asesor-decision-funding \{/);
  assert.match(css, /\.e19-asesor-decision \.asesor-decision-stats,\s*\n\.e19-deuda-decidir \.asesor-decision-stats \{/);
});

test("Deuda · viaja en el shell offline versionado", () => {
  assert.match(worker, /20260814-f1a1/);
  assert.match(html, /app\.js\?v=20260814f1a1/);
  assert.match(html, /design-tokens\.css\?v=20260814f1a1/);
});
