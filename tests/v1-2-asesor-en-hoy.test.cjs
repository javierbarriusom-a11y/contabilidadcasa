const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");

// V1-2 · Hoy nunca enlazaba a #asesor-decision, la pantalla que desde E20-2 resuelve por completo
// «una decisión abierta a la vez» (§8 de docs/E19_SISTEMA_DISENO.md). No hacía falta ningún cálculo
// nuevo, solo asomar la primera oferta abierta (`asesorDecisionOpenOffers()`) como una lectura más
// de Hoy. Cierra la vista 1 · Hoy por completo: es la última pieza que quedaba.

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js`);
  let depth = 0;
  for (let index = app.indexOf("{", start); index < app.length; index += 1) {
    if (app[index] === "{") depth += 1;
    else if (app[index] === "}") {
      depth -= 1;
      if (depth === 0) return app.slice(start, index + 1);
    }
  }
  throw new Error(`La función ${name} no cierra sus llaves`);
}

function sandbox() {
  const context = {
    money: (value) => `${Number(value).toFixed(2)} €`,
    escenarioMotorMonthLabel: (value) => `etiqueta:${value}`,
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("homeOpenOfferInsight"), context);
  return context;
}

test("V1-2 · sin oferta abierta, no hay nada que insertar", () => {
  const { homeOpenOfferInsight } = sandbox();
  assert.equal(homeOpenOfferInsight(null), null);
  assert.equal(homeOpenOfferInsight(undefined), null);
});

test("V1-2 · con una oferta abierta, la insight lleva contraparte, importe y vencimiento", () => {
  const { homeOpenOfferInsight } = sandbox();
  const insight = homeOpenOfferInsight({ counterpart: "Cetelem", amount: 4200, expiresAt: "2026-09" });
  assert.equal(insight.title, "Decisión de deuda abierta");
  assert.match(insight.text, /Cetelem/);
  assert.match(insight.text, /4200\.00 €/);
  assert.match(insight.text, /vence etiqueta:2026-09/);
  assert.equal(insight.target, "asesor-decision");
  assert.equal(insight.cta, "Revisar oferta");
  assert.equal(insight.status, "warn");
});

test("V1-2 · sin contraparte o sin vencimiento, no inventa el dato", () => {
  const { homeOpenOfferInsight } = sandbox();
  const sinContraparte = homeOpenOfferInsight({ amount: 100 });
  assert.match(sinContraparte.text, /sin contraparte/);
  assert.ok(!/vence/.test(sinContraparte.text), "sin vencimiento indicado, no debe decir «vence»");
});

test("V1-2 · Hoy reutiliza asesorDecisionOpenOffers, sin recalcular nada nuevo", () => {
  const render = extractFunction("renderHomeDashboard");
  assert.match(render, /homeOpenOfferInsight\(asesorDecisionOpenOffers\(\)\[0\]\)/);
  assert.match(render, /if \(openOfferInsight\) mainInsights\.push\(openOfferInsight\);/);
});

test("V1-2 · la tarjeta lleva a #asesor-decision, la pantalla que ya resuelve la decisión", () => {
  assert.match(app, /target: "asesor-decision"/);
});
