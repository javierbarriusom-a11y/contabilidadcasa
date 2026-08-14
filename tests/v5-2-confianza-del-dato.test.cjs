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

// V5-2 · «Confianza del dato» por cuenta (mockup 4f, columna de #conciliar): las dos cuentas
// reales del hogar (CaixaBank, Mediolanum) — el mockup mencionaba una tarjeta de crédito que este
// modelo no tiene, así que no se inventa. «Descuadra» prioriza el error de continuidad de saldo
// cuando existe; si el saldo cuadra pero quedan movimientos sin clasificar de esa cuenta, usa la
// suma de esos importes en su lugar. Las diferencias banco-vs-real de #conciliar son mensuales, no
// por cuenta, así que no entran en esta cifra — omisión documentada, no un olvido.

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

function extractConst(name) {
  const start = app.indexOf(`const ${name} = `);
  assert.ok(start >= 0, `No existe la constante ${name}`);
  const end = app.indexOf("};", start);
  return app.slice(start, end + 2);
}

const FUNCTIONS = ["conciliarAccountConfidence", "conciliarConfidenceStateLabel", "renderConciliarConfidence"];

function field() {
  return { innerHTML: "" };
}

function sandbox({ fields = {} } = {}) {
  const elements = new Map(Object.entries(fields));
  const context = {
    qs: (id) => elements.get(id) || null,
    money: (value) => `${Number(value).toFixed(2)} €`,
    escapeHtml: (value) => String(value ?? ""),
    round2: (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100,
  };
  vm.createContext(context);
  vm.runInContext(extractConst("CONCILIAR_ACCOUNT_LABELS"), context);
  vm.runInContext(FUNCTIONS.map(extractFunction).join("\n"), context, { filename: "app.js#v5-2-confianza-del-dato" });
  return context;
}

function unclassifiedEntry(accountId, amount) {
  return { accountId, amount, duplicateOf: null, mapping: { status: "unclassified" } };
}

test("V5-2 · sin sobresaltos, una cuenta con saldo continuo y todo clasificado cuadra", () => {
  const context = sandbox();
  const checks = [{ accountId: "caixabank", gaps: [], totalError: 0 }, { accountId: "mediolanum", gaps: [], totalError: 0 }];
  const rows = context.conciliarAccountConfidence([], checks);
  assert.equal(rows.map((row) => row.status).join(","), "cuadra,cuadra");
  assert.equal(rows.map((row) => row.amount).join(","), "0,0");
});

test("V5-2 · un salto de saldo descuadra la cuenta con el error acumulado, no con lo sin clasificar", () => {
  const context = sandbox();
  const checks = [{ accountId: "caixabank", gaps: [{ id: 1 }], totalError: -62 }];
  const entries = [unclassifiedEntry("caixabank", 5)];
  const [caixa] = context.conciliarAccountConfidence(entries, checks);
  assert.equal(caixa.status, "descuadra");
  assert.equal(caixa.amount, 62, "el error de continuidad manda sobre lo sin clasificar cuando los dos existen");
});

test("V5-2 · sin salto de saldo pero con movimientos sin clasificar, descuadra por la suma de esos importes", () => {
  const context = sandbox();
  const checks = [{ accountId: "mediolanum", gaps: [], totalError: 0 }];
  const entries = [unclassifiedEntry("mediolanum", 10), unclassifiedEntry("mediolanum", 5.5), unclassifiedEntry("caixabank", 999)];
  const [, mediolanum] = context.conciliarAccountConfidence(entries, checks);
  assert.equal(mediolanum.status, "descuadra");
  assert.equal(mediolanum.amount, 15.5, "solo suma lo sin clasificar de esa cuenta, no de la otra");
});

test("V5-2 · movimientos clasificados o duplicados no cuentan como sin clasificar", () => {
  const context = sandbox();
  const checks = [{ accountId: "caixabank", gaps: [], totalError: 0 }];
  const entries = [
    { accountId: "caixabank", amount: 40, duplicateOf: null, mapping: { status: "classified" } },
    { accountId: "caixabank", amount: 40, duplicateOf: "otro-id", mapping: { status: "unclassified" } },
  ];
  const [caixa] = context.conciliarAccountConfidence(entries, checks);
  assert.equal(caixa.status, "cuadra");
});

test("V5-2 · sin ningún movimiento importado para esa cuenta, está sin conciliar", () => {
  const context = sandbox();
  const rows = context.conciliarAccountConfidence([], []);
  assert.equal(rows.map((row) => row.status).join(","), "sin-conciliar,sin-conciliar");
});

test("V5-2 · las dos cuentas reales del hogar, con su nombre, ninguna tarjeta inventada", () => {
  const context = sandbox();
  const rows = context.conciliarAccountConfidence([], []);
  assert.equal(rows.map((row) => `${row.accountId}:${row.label}`).join(","), "caixabank:CaixaBank,mediolanum:Mediolanum");
});

test("V5-2 · el estado se lee en una frase, con el importe solo cuando descuadra", () => {
  const context = sandbox();
  assert.equal(context.conciliarConfidenceStateLabel({ status: "cuadra" }), "Cuadra");
  assert.equal(context.conciliarConfidenceStateLabel({ status: "sin-conciliar" }), "Sin conciliar");
  assert.equal(context.conciliarConfidenceStateLabel({ status: "descuadra", amount: 62 }), "Descuadra 62.00 €");
});

test("V5-2 · el panel se pinta con una fila por cuenta y su estado como clase", () => {
  const note = field();
  const context = sandbox({ fields: { conciliarConfidence: note } });
  context.renderConciliarConfidence([], [{ accountId: "caixabank", gaps: [{ id: 1 }], totalError: 12 }]);
  assert.match(note.innerHTML, /class="conciliar-confidence-item is-descuadra"/);
  assert.match(note.innerHTML, /CaixaBank/);
  assert.match(note.innerHTML, /Descuadra 12\.00 €/);
  assert.match(note.innerHTML, /class="conciliar-confidence-item is-sin-conciliar"/);
  assert.match(note.innerHTML, /Mediolanum/);
});

test("V5-2 · no revienta si el elemento no está en la página", () => {
  const context = sandbox();
  assert.doesNotThrow(() => context.renderConciliarConfidence([], []));
});

test("V5-2 · Cierre llama al panel nuevo con lo que ya tenía calculado, sin recalcular nada", () => {
  const conciliar = extractFunction("renderConciliar");
  assert.match(conciliar, /renderConciliarConfidence\(entries, checks\);/);
});

test("V5-2 · el panel vive en #conciliar, junto a «Al cerrar el mes», con su CSS", () => {
  assert.match(html, /id="conciliarConfidence"/);
  const confidenceIndex = html.indexOf('id="conciliarConfidence"');
  const checklistIndex = html.indexOf('id="conciliarChecklist"');
  assert.ok(confidenceIndex > 0 && confidenceIndex < checklistIndex, "Confianza del dato debe ir antes que Al cerrar el mes, como en el mockup");
  assert.match(css, /\.conciliar-confidence-item\.is-cuadra .conciliar-confidence-state/);
  assert.match(css, /\.conciliar-confidence-item\.is-descuadra/);
});

test("V5-2 · viaja en el shell offline versionado", () => {
  assert.match(worker, /20260814-f1a1/);
  assert.match(html, /app\.js\?v=20260814f1a1/);
  assert.match(html, /design-tokens\.css\?v=20260814f1a1/);
});
