const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const roadmapHtml = fs.readFileSync(path.join(root, "debt-roadmap.html"), "utf8");
const E14DebtOperations = require(path.join(root, "canonical-e14-operations.js"));
const E14DebtAdapter = require(path.join(root, "canonical-e14-debt-adapter.js"));

// D1 (Fase 3, confirmada por el hogar el 28 de septiembre de 2026): puente sandbox → plan real, en
// su versión más segura. El sandbox (debt-roadmap.html) nunca escribe en los contratos reales: al
// pulsar "enviar esta estrategia al plan real" solo crea o actualiza una OFERTA BORRADOR en el
// mismo cauce ya existente (E14b, "Plan de deuda"), que sigue exigiendo completar la vigencia y
// pasar por applyE14bOffer() (confirmación obligatoria, A11-4) antes de que nada real cambie.
// La resolución de cuenta→contrato y la construcción de la oferta son lógica pura en
// canonical-e14-debt-adapter.js (ver su propio test); aquí solo se cubre la fachada de app.js
// (receiveDebtRoadmapOffer, el cableado del listener y el buzón de decisiones) y la estructura del
// sandbox. Mismo truco de extracción por llaves que el resto de la suite: app.js es un script de
// navegador, no un módulo.

function extractFunction(name, source = app) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name}`);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = source.indexOf("(", start); index < source.length; index += 1) {
    if (source[index] === "(") parenDepth += 1;
    else if (source[index] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) {
        bodyStart = source.indexOf("{", index);
        break;
      }
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
  throw new Error(`La función ${name} no cierra sus llaves`);
}

function sandboxWith(names, extra = {}) {
  const context = { ...extra };
  vm.createContext(context);
  names.forEach((name) => vm.runInContext(extractFunction(name), context));
  return context;
}

const BRIDGE_NAMES = ["debtRoadmapCanonicalReadModel", "receiveDebtRoadmapOffer", "e14bWorkspace"];

function makeContext({ canonical = null, scenarioSettings = {} } = {}) {
  const postedToFrame = [];
  const qsMap = {
    debtRoadmapFrame: { contentWindow: { postMessage: (...args) => postedToFrame.push(args) } },
  };
  const context = sandboxWith(BRIDGE_NAMES, {
    E14DebtOperations,
    E14DebtAdapter: { ...E14DebtAdapter, buildReadModel: () => canonical },
    canonicalDebtContractRows: () => [],
    canonicalScenarioResults: {},
    debtRoadmapState: {},
    scenarioSettings,
    queueRemoteSave: () => {},
    renderE14bPanel: () => {},
    qs: (id) => qsMap[id],
    window: { location: { origin: "https://example.test" } },
  });
  context.__postedToFrame = postedToFrame;
  return context;
}

// --- receiveDebtRoadmapOffer (app.js) · fachada fina sobre E14DebtAdapter.buildDraftOffer --------

test("receiveDebtRoadmapOffer · crea una oferta borrador cuando la cuenta está vinculada y tiene desembolso", () => {
  const scenarioSettings = {};
  const canonical = { contracts: { entityA: { id: "debt-1", entity: "Entidad A", currentPrincipal: 4000 }, entityB: null }, extraDebts: [] };
  const context = makeContext({ canonical, scenarioSettings });
  context.receiveDebtRoadmapOffer({ accountKey: "cb", account: { strategy: "settlement", lump: 1800, financed: 0, monthly: 0, apr: 0, term: 1 } });
  const offers = scenarioSettings.e14Debt.offers;
  assert.equal(offers.length, 1);
  assert.equal(offers[0].contractId, "debt-1");
  assert.equal(offers[0].counterpart, "Entidad A");
  assert.equal(offers[0].amount, 1800);
  assert.equal(offers[0].status, "draft");
  assert.equal(offers[0].source, "sandbox");
  assert.equal(offers[0].expiresAt, "", "nunca inventa un vencimiento que no existe");
  const [message] = context.__postedToFrame[0];
  assert.equal(message.type, "finance-debt-roadmap-offer-result");
  assert.equal(message.ok, true);
});

test("receiveDebtRoadmapOffer · un segundo envío de la misma cuenta actualiza la oferta borrador existente, nunca la duplica", () => {
  const scenarioSettings = {};
  const canonical = { contracts: { entityA: { id: "debt-1", entity: "Entidad A", currentPrincipal: 4000 }, entityB: null }, extraDebts: [] };
  const context = makeContext({ canonical, scenarioSettings });
  context.receiveDebtRoadmapOffer({ accountKey: "cb", account: { strategy: "settlement", lump: 1800, financed: 0, monthly: 0, apr: 0, term: 1 } });
  const firstId = scenarioSettings.e14Debt.offers[0].id;
  context.receiveDebtRoadmapOffer({ accountKey: "cb", account: { strategy: "settlement", lump: 2200, financed: 0, monthly: 0, apr: 0, term: 1 } });
  const offers = scenarioSettings.e14Debt.offers;
  assert.equal(offers.length, 1, "sigue habiendo una sola oferta borrador para esta cuenta");
  assert.equal(offers[0].id, firstId, "conserva el mismo id");
  assert.equal(offers[0].amount, 2200, "refleja la simulación más reciente");
});

test("receiveDebtRoadmapOffer · cuenta sin contrato real vinculado, no guarda nada y avisa por qué", () => {
  const scenarioSettings = {};
  const canonical = { contracts: { entityA: null, entityB: null }, extraDebts: [] };
  const context = makeContext({ canonical, scenarioSettings });
  context.receiveDebtRoadmapOffer({ accountKey: "cb", account: { strategy: "settlement", lump: 1800, financed: 0, monthly: 0, apr: 0, term: 1 } });
  assert.equal(scenarioSettings.e14Debt.offers.length, 0, "no guarda ninguna oferta si no hay contrato al que vincularla");
  const [message] = context.__postedToFrame[0];
  assert.equal(message.ok, false);
  assert.match(message.message, /vinculada/);
});

test("receiveDebtRoadmapOffer · estrategia 'esperar' (sin desembolso), no guarda una oferta vacía", () => {
  const scenarioSettings = {};
  const canonical = { contracts: { entityA: { id: "debt-1", entity: "Entidad A", currentPrincipal: 4000 }, entityB: null }, extraDebts: [] };
  const context = makeContext({ canonical, scenarioSettings });
  context.receiveDebtRoadmapOffer({ accountKey: "cb", account: { strategy: "hold", lump: 0, financed: 0, monthly: 0, apr: 0, term: 1 } });
  assert.ok(!scenarioSettings.e14Debt?.offers?.length);
  const [message] = context.__postedToFrame[0];
  assert.equal(message.ok, false);
  assert.match(message.message, /desembolso/);
});

test("receiveDebtRoadmapOffer · una cuenta dinámica (D1 Fase 2) también puede enviar su estrategia al plan real", () => {
  const scenarioSettings = {};
  const canonical = { contracts: { entityA: null, entityB: null }, extraDebts: [{ id: "debt-3", entity: "Préstamo coche", currentPrincipal: 900 }] };
  const context = makeContext({ canonical, scenarioSettings });
  context.receiveDebtRoadmapOffer({ accountKey: "acct_debt-3", account: { strategy: "refi", lump: 0, financed: 900, monthly: 45, apr: 8, term: 24 } });
  const offers = scenarioSettings.e14Debt.offers;
  assert.equal(offers.length, 1);
  assert.equal(offers[0].contractId, "debt-3");
  assert.equal(offers[0].counterpart, "Préstamo coche");
  assert.equal(offers[0].amount, 900);
  assert.equal(offers[0].paymentType, "refinancing");
});

// --- Cableado en app.js: el listener del sandbox y el buzón de decisiones ------------------------

test("wiring: setupDebtRoadmapBridge enruta finance-debt-roadmap-send-offer a receiveDebtRoadmapOffer", () => {
  const bridge = extractFunction("setupDebtRoadmapBridge");
  assert.match(bridge, /event\.data\?\.type === "finance-debt-roadmap-send-offer"/);
  assert.match(bridge, /receiveDebtRoadmapOffer\(event\.data\.payload\)/);
});

test("wiring: decisionInboxItems asoma las ofertas borrador del sandbox pendientes de completar", () => {
  assert.match(app, /id: "decision-inbox-sandbox-debt-offer"/);
  assert.match(app, /source: "Sandbox de deuda"/);
  assert.match(app, /target: "debt-roadmap"/);
  assert.match(app, /offer\.source === "sandbox" && offer\.status === "draft"/);
});

// --- Estructura en debt-roadmap.html ---------------------------------------------------------

test("debt-roadmap.html · Entidad A y Entidad B tienen su botón de enviar al plan real", () => {
  assert.match(roadmapHtml, /id="cb_send_offer" onclick="sendAccountOffer\('cb'\)"/);
  assert.match(roadmapHtml, /id="bk_send_offer" onclick="sendAccountOffer\('bk'\)"/);
  assert.match(roadmapHtml, /id="cb_send_offer_status"/);
  assert.match(roadmapHtml, /id="bk_send_offer_status"/);
});

test("debt-roadmap.html · las cuentas dinámicas (D1 Fase 2) también generan su propio botón de enviar", () => {
  assert.match(roadmapHtml, /id="\$\{key\}_send_offer" onclick="sendAccountOffer\('\$\{key\}'\)"/);
});

test("debt-roadmap.html · sendAccountOffer envía el tipo de mensaje correcto y nunca escribe en el propio estado del sandbox", () => {
  const fn = extractFunction("sendAccountOffer", roadmapHtml);
  assert.match(fn, /type:'finance-debt-roadmap-send-offer'/);
  assert.match(fn, /accountKey:prefix/);
  assert.doesNotMatch(fn, /localStorage/, "enviar la propuesta no debe tocar el guardado local del propio sandbox");
});

test("debt-roadmap.html · dynamicAccountKey (app.js/adapter) coincide siempre con accountKey() del propio sandbox", () => {
  const sandboxKeyFn = extractFunction("accountKey", roadmapHtml);
  const context = sandboxWith([]);
  vm.runInContext(sandboxKeyFn, context);
  const sampleIds = ["debt-3", "debt-custom-1", "Deuda con espacios", "Préstamo/coche", "id_con_guion-bajo"];
  sampleIds.forEach((id) => {
    assert.equal(E14DebtAdapter.dynamicAccountKey(id), context.accountKey(id), `clave distinta para "${id}"`);
  });
});

test("debt-roadmap.html · el botón se desactiva si la cuenta no está vinculada o la estrategia es 'esperar'", () => {
  const fn = extractFunction("refreshSendOfferButton", roadmapHtml);
  assert.match(fn, /sendOfferContractLinked\(prefix\)/);
  assert.match(fn, /strategy==='hold'/);
});

test("debt-roadmap.html · updateStrategyFields mantiene el botón de envío sincronizado con la estrategia elegida", () => {
  const fn = extractFunction("updateStrategyFields", roadmapHtml);
  assert.match(fn, /refreshSendOfferButton\(prefix\)/);
});

test("debt-roadmap.html · el listener de mensajes atiende la confirmación de la oferta sin tocar el resto del protocolo de hidratación", () => {
  assert.match(roadmapHtml, /finance-debt-roadmap-offer-result/);
  assert.match(roadmapHtml, /event\.data\?\.type!=='finance-debt-roadmap-hydrate'\)return;parentHydrating=true/);
});
