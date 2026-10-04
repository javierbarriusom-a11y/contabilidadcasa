const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// WP-26 · ND-02: un extracto actualiza el saldo y los movimientos a la vez. El paso 4 de «Importar extracto» ofrece
// (marcado) usar el saldo final del extracto como saldo declarado de su cuenta, dice si al fichero le faltan
// movimientos (continuidad del saldo corrido) y lo aplica dentro del mismo lote, así que «Deshacer último lote» también
// lo devuelve. De paso, la cuenta elegida al importar llega por fin al libro canónico (antes todo era «caixabank»).

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const ui = read("registrar-ui.js");
const pulse = require("../canonical-balance-pulse.js");
const plain = (value) => JSON.parse(JSON.stringify(value));

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, name);
  return source.slice(start, source.indexOf("\n}\n", start) + 2);
}

const DESC = [
  { date: "2026-10-02", amount: -20, balance: 970, statementOrder: 0 },
  { date: "2026-10-02", amount: -10, balance: 990, statementOrder: 0 },
  { date: "2026-10-01", amount: -5, balance: 1000, statementOrder: 0 },
];

test("la cuenta elegida al importar llega al libro; sin elegir, como siempre (CaixaBank)", () => {
  assert.equal(pulse.ledgerAccountId("CaixaBank"), "caixabank");
  assert.equal(pulse.ledgerAccountId("Mediolanum"), "mediolanum");
  assert.equal(pulse.ledgerAccountId("Efectivo"), "efectivo");
  assert.equal(pulse.ledgerAccountId(""), "");
  assert.equal(pulse.ledgerAccountId("toString"), "", "nada heredado del prototipo");
  assert.match(extractFunction(app, "canonicalLedgerTransactions"), /accountId: transaction\.accountId \|\| globalThis\.FinanceCanonicalBalancePulse\?\.ledgerAccountId\(transaction\.account\) \|\| "caixabank",/);
});

test("continuidad: sin huecos en los dos órdenes del banco; en CSV vale el orden de lectura", () => {
  assert.deepEqual(pulse.statementContinuity(DESC), { checked: 2, gaps: [] }, "del más nuevo al más antiguo (CSV, todo statementOrder 0)");
  assert.deepEqual(pulse.statementContinuity(DESC.slice().reverse()), { checked: 2, gaps: [] }, "del más antiguo al más nuevo");
  const excel = [
    { date: "2026-10-01", amount: -5, balance: 1000, statementOrder: 3 },
    { date: "2026-10-02", amount: -20, balance: 970, statementOrder: 1 },
    { date: "2026-10-02", amount: -10, balance: 990, statementOrder: 2 },
  ];
  assert.deepEqual(pulse.statementContinuity(excel), { checked: 2, gaps: [] }, "Excel: manda el número de fila, no el orden en que llegan");
  assert.deepEqual(pulse.statementContinuity(DESC.slice(0, 1)), { checked: 0, gaps: [] });
  assert.deepEqual(pulse.statementContinuity([{ date: "2026-10-01", amount: 1, balance: null }, { date: "2026-10-02", amount: 1, balance: null }]), { checked: 0, gaps: [] }, "sin columna de saldo no se comprueba nada");
});

test("continuidad: un hueco dice entre qué fechas faltan movimientos y cuánto", () => {
  const gap = [
    { date: "2026-10-03", amount: -20, balance: 900, statementOrder: 0 },
    { date: "2026-10-02", amount: -10, balance: 990, statementOrder: 0 },
    { date: "2026-10-01", amount: -5, balance: 1000, statementOrder: 0 },
  ];
  assert.deepEqual(plain(pulse.statementContinuity(gap)), { checked: 2, gaps: [{ from: "2026-10-02", to: "2026-10-03", difference: -70 }] });
});

test("oferta: solo con una de las dos cuentas, con saldo en el extracto y si no es más antiguo que lo declarado", () => {
  const declared = { value: 5610, date: "2026-09-28" };
  assert.equal(pulse.statementOffer({ rows: DESC, accountLabel: "", declared }).status, "sin-cuenta");
  assert.equal(pulse.statementOffer({ rows: DESC, accountLabel: "Efectivo", declared }).status, "cuenta-sin-saldo");
  assert.equal(pulse.statementOffer({ rows: DESC.map((row) => ({ ...row, balance: null })), accountLabel: "CaixaBank", declared }).status, "sin-saldo");
  const older = pulse.statementOffer({ rows: DESC, accountLabel: "CaixaBank", declared: { value: 5610, date: "2026-10-03" } });
  assert.deepEqual([older.status, older.value, older.declaredDate], ["declarado-mas-reciente", 970, "2026-10-03"]);
  const offer = pulse.statementOffer({ rows: DESC, accountLabel: "CaixaBank", declared });
  assert.deepEqual(plain(offer), { status: "ofrecer", account: "caixa", accountLabel: "CaixaBank", value: 970, date: "2026-10-02", same: false, ambiguous: false, continuity: { checked: 2, gaps: [] } });
  assert.equal(pulse.statementOffer({ rows: DESC, accountLabel: "Mediolanum", declared: { value: 970, date: "2026-10-02" } }).same, true, "misma fecha y cifra: solo se confirma");
  assert.equal(pulse.statementOffer({ rows: DESC, accountLabel: "CaixaBank", declared: { value: 1, date: "" } }).status, "ofrecer", "en modo auto no hay fecha declarada que gane");
});

test("pantalla de la oferta: casilla marcada por defecto, cifra y fecha, hueco con aviso, casos sin oferta explicados", () => {
  const money = (value) => `${value} €`;
  const offer = pulse.statementOffer({ rows: DESC, accountLabel: "CaixaBank", declared: { value: 5610, date: "2026-09-28" } });
  const html = pulse.renderOfferHtml(offer, { money });
  assert.match(html, /<input type="checkbox" id="datosImportarSaldoOferta" checked \/>/);
  assert.match(html, /Usar el saldo final del extracto, <strong>970 €<\/strong> el 02\/10, como saldo declarado de CaixaBank\./);
  assert.match(html, /Sin huecos en el extracto: cada saldo es el anterior más su movimiento \(2 comprobaciones\)/);
  assert.doesNotMatch(pulse.renderOfferHtml(offer, { money, checked: false }), / checked /);
  const gap = pulse.statementOffer({ rows: [{ date: "2026-10-03", amount: -20, balance: 900 }, ...DESC.slice(1)], accountLabel: "Mediolanum", declared: { value: 1, date: "" } });
  assert.match(pulse.renderOfferHtml(gap, { money }), /Al extracto le faltan movimientos: entre el 02\/10 y el 03\/10\. Los reales de esos días quedarán incompletos/);
  assert.match(pulse.renderOfferHtml(pulse.statementOffer({ rows: DESC, accountLabel: "", declared: {} }), { money }), /Elige en el paso 1 de qué cuenta es el extracto/);
  assert.match(pulse.renderOfferHtml(pulse.statementOffer({ rows: DESC, accountLabel: "CaixaBank", declared: { value: 1, date: "2026-10-05" } }), { money }), /es más antiguo que el que ya declaraste para CaixaBank \(05\/10\): no se cambia/);
  assert.doesNotMatch(pulse.renderOfferHtml(pulse.statementOffer({ rows: DESC, accountLabel: "CaixaBank", declared: { value: 1, date: "2026-10-05" } }), { money }), /type="checkbox"/);
});

test("aplicar: con la casilla marcada, la cuenta toma el saldo del extracto y los saldos su fecha; sin marcar, nada", () => {
  const saved = [];
  const fields = {};
  const context = {
    window: { FinanceCanonicalBalancePulse: pulse },
    state: { balanceMode: "manual", balanceDate: "2026-09-28" },
    balances: { caixa: 5610, mediolanum: 4200 },
    accountBalancesFromState() { return { ...this.balances }; },
    setStateAccountBalances(next) { this.balances = { caixa: next.caixa, mediolanum: next.mediolanum }; },
    saveBalanceSettings: () => saved.push("guardado"),
    qs: (id) => (fields[id] ||= { value: "" }),
    datosImportarIncludedTransactions: (rows) => rows.map((row) => row.transaction),
  };
  context.accountBalancesFromState = context.accountBalancesFromState.bind(context);
  context.setStateAccountBalances = context.setStateAccountBalances.bind(context);
  vm.runInNewContext(`${extractFunction(ui, "datosImportarBalanceOffer")}\n${extractFunction(ui, "applyDatosImportarBalanceOffer")}\nthis.apply = applyDatosImportarBalanceOffer;`, context);
  const session = { fileMeta: { bankAccount: "CaixaBank" }, rows: DESC.map((transaction) => ({ transaction })) };
  assert.equal(context.apply({ ...session, balanceOffer: false }), null, "desmarcada: no se toca");
  assert.deepEqual(saved, []);
  assert.deepEqual(plain(context.apply(session)), { account: "CaixaBank", value: 970, date: "2026-10-02", gaps: 0 });
  assert.deepEqual(context.balances, { caixa: 970, mediolanum: 4200 }, "la otra cuenta no cambia");
  assert.deepEqual([context.state.balanceMode, context.state.balanceDate, fields.registrarBalanceDate.value], ["manual", "2026-10-02", "2026-10-02"]);
  assert.deepEqual(saved, ["guardado"]);
  context.state.balanceDate = "2026-10-05";
  assert.equal(context.apply(session), null, "un extracto más antiguo que lo declarado no se aplica");
});

test("app.js: la oferta va en el paso 4 y se aplica DENTRO del lote (antes de la foto del «después»), con su resumen", () => {
  const step4 = extractFunction(app, "renderDatosImportarStep4");
  assert.match(step4, /\$\{datosImportarBalanceOfferHtml\(session\)\}\s*<button type="button" class="e19-btn e19-btn-primary" id="\$\{target\.confirmId\}">Incorporar al plan<\/button>/);
  assert.match(step4, /wireDatosImportarBalanceOffer\(session\);/);
  const apply = extractFunction(app, "datosImportarApply");
  const at = apply.indexOf("const balance = applyDatosImportarBalanceOffer(session);");
  assert.ok(at > apply.indexOf("mergeTransactions(") && at < apply.indexOf("const afterState = appStatePayload"), "dentro del lote: «Deshacer último lote» lo devuelve");
  assert.match(apply, /changed: \{ records: incoming\.length, movements: incoming\.length, actuals: appliedActuals, balances: balance \? 1 : 0 \}/);
  assert.match(apply, /return \{ [^}]*batchId: batch\.id, balance \};/);
  assert.match(extractFunction(app, "datosImportarSuccessMarkup"), /Saldo de \$\{escapeHtml\(result\.balance\.account\)\}/);
  assert.match(ui, /session\.balanceOffer = event\.target\.checked;\s*datosImportarPersistDraft\(\);/, "la decisión viaja con el borrador");
});
