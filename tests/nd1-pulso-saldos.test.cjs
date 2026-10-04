const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// WP-26 · ND-01: «Pulso de saldos». Registrar enseña lo último que se sabe de cada cuenta (el saldo declarado o el
// saldo final del extracto, el más reciente: un dato real, nunca una estimación) con «Coincide» / «Corregir». Con
// las dos cuentas respondidas, los saldos quedan con fecha de hoy y se puede deshacer 8 s. La previsión solo avisa:
// si esperaba movimientos desde esa fecha, es raro que el saldo siga igual (el riesgo es confirmar sin mirar).

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const html = read("index.html");
const pulse = require("../canonical-balance-pulse.js");
const [CAIXA, MEDIOLANUM] = pulse.ACCOUNTS;
const plain = (value) => JSON.parse(JSON.stringify(value));

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, name);
  return source.slice(start, source.indexOf("\n}\n", start) + 2);
}

test("saldo final del extracto: el último día y, en ese día, el que cierra la cadena (vale en los dos órdenes del banco)", () => {
  const asc = [
    { date: "2026-10-01", amount: -5, balance: 1000, statementOrder: 1, account: "CaixaBank" },
    { date: "2026-10-02", amount: -10, balance: 990, statementOrder: 1, account: "CaixaBank" },
    { date: "2026-10-02", amount: -20, balance: 970, statementOrder: 2, account: "CaixaBank" },
  ];
  assert.deepEqual(pulse.statementFinalBalance(asc, CAIXA), { value: 970, date: "2026-10-02", ambiguous: false });
  const desc = [
    { date: "2026-10-02", amount: -20, balance: 970, statementOrder: 1, account: "CaixaBank" },
    { date: "2026-10-02", amount: -10, balance: 990, statementOrder: 2, account: "CaixaBank" },
    { date: "2026-10-01", amount: -5, balance: 1000, statementOrder: 3, account: "CaixaBank" },
  ];
  assert.deepEqual(pulse.statementFinalBalance(desc, CAIXA), { value: 970, date: "2026-10-02", ambiguous: false }, "el banco que lista del más nuevo al más antiguo");
});

test("saldo final del extracto: por cuenta; sin cuenta indicada cuenta como CaixaBank; sin saldo o fecha, nada", () => {
  const rows = [
    { date: "2026-10-03", amount: 100, balance: 4300, account: "Mediolanum" },
    { date: "2026-09-30", amount: -1, balance: 500 },
    { date: "2026-10-04", amount: -1, balance: null },
    { date: "", amount: -1, balance: 700 },
    { date: "2026-10-04", amount: -1, balance: "abc" },
  ];
  assert.deepEqual(pulse.statementFinalBalance(rows, MEDIOLANUM), { value: 4300, date: "2026-10-03", ambiguous: false });
  assert.deepEqual(pulse.statementFinalBalance(rows, CAIXA), { value: 500, date: "2026-09-30", ambiguous: false }, "importado antes de poder elegir la cuenta");
  assert.equal(pulse.statementFinalBalance([{ date: "2026-10-01", balance: 1, account: "Efectivo" }], CAIXA), null);
  assert.equal(pulse.statementFinalBalance([], CAIXA), null);
  const broken = [{ date: "2026-10-02", amount: -10, balance: 990, statementOrder: 1 }, { date: "2026-10-02", amount: -20, balance: 500, statementOrder: 2 }];
  assert.deepEqual(pulse.statementFinalBalance(broken, CAIXA), { value: 500, date: "2026-10-02", ambiguous: true }, "sin cadena clara: el último del fichero, y se marca");
});

test("lo último que se sabe: el más reciente; a igual fecha, el declarado; sin fecha declarada (modo auto), el extracto", () => {
  const statement = { value: 970, date: "2026-10-02" };
  assert.deepEqual(pulse.knownBalance({ declared: { value: 1000, date: "2026-09-28" }, statement }), { value: 970, date: "2026-10-02", source: "extracto" });
  assert.deepEqual(pulse.knownBalance({ declared: { value: 1000, date: "2026-10-03" }, statement }), { value: 1000, date: "2026-10-03", source: "declarado" });
  assert.deepEqual(pulse.knownBalance({ declared: { value: 1000, date: "2026-10-02" }, statement }), { value: 1000, date: "2026-10-02", source: "declarado" });
  assert.deepEqual(pulse.knownBalance({ declared: { value: 1000, date: "" }, statement }), { value: 970, date: "2026-10-02", source: "extracto" });
  assert.deepEqual(pulse.knownBalance({ declared: { value: 1000, date: "2026-10-01" }, statement: null }), { value: 1000, date: "2026-10-01", source: "declarado" });
  assert.deepEqual(pulse.knownBalance({ declared: { value: undefined, date: "" }, statement: null }), { value: null, date: "", source: "ninguno" });
});

test("aviso de la previsión: cuánto esperaba moverse la cuenta desde el cierre de ese día hasta hoy", () => {
  const rows = [{ date: "2026-09-28", checking: 5610, savings: 4200 }, { date: "2026-10-01", checking: 4810, savings: 5000 }, { date: "2026-10-04", checking: 4800, savings: 5000 }];
  assert.equal(pulse.planDelta(rows, "2026-09-28", "2026-10-04", "checking"), -810);
  assert.equal(pulse.planDelta(rows, "2026-09-28", "2026-10-04", "savings"), 800);
  assert.equal(pulse.planDelta(rows, "2026-10-04", "2026-10-04", "checking"), null, "de hoy: nada que avisar");
  assert.equal(pulse.planDelta(rows, "2026-09-01", "2026-10-04", "checking"), null, "sin esa fila no se inventa");
  assert.equal(pulse.planDelta(null, "2026-09-28", "2026-10-04", "checking"), null);
  const model = pulse.buildModel({ accounts: [{ id: "caixa", label: "CaixaBank", known: { value: 1, date: "2026-09-28", source: "declarado" }, planDelta: 0.4 }], today: "2026-10-04" });
  assert.equal(model.items[0].hint, null, "menos de 1 €: sin aviso");
});

test("modelo: respuestas, edad, completo solo con todas; «Coincide» toma lo último que se sabe y «Corregir» lo escrito", () => {
  const accounts = [
    { id: "caixa", label: "CaixaBank", known: { value: 970, date: "2026-10-02", source: "extracto" }, planDelta: -810 },
    { id: "mediolanum", label: "Mediolanum", known: { value: 4200, date: "2026-09-28", source: "declarado" }, planDelta: null },
  ];
  const partial = pulse.buildModel({ accounts, answers: { mediolanum: "coincide", otra: "x" }, today: "2026-10-04" });
  assert.deepEqual(plain(partial.items.map((item) => [item.id, item.answer, item.ageDays, item.hint])), [["caixa", "", 2, -810], ["mediolanum", "coincide", 6, null]]);
  assert.equal(partial.complete, false);
  assert.equal(partial.pending, 1);
  const done = pulse.buildModel({ accounts, answers: { mediolanum: "coincide", caixa: "coincide" }, today: "2026-10-04" });
  assert.equal(done.complete, true);
  assert.deepEqual(pulse.resultingBalances(done, { caixa: 1000, mediolanum: 4200 }), { caixa: 970, mediolanum: 4200 }, "el extracto más reciente pasa a ser el saldo declarado");
  const corrected = pulse.buildModel({ accounts, answers: { mediolanum: "coincide", caixa: "corregido" }, today: "2026-10-04" });
  assert.deepEqual(pulse.resultingBalances(corrected, { caixa: 4321.5, mediolanum: 4200 }), { caixa: 4321.5, mediolanum: 4200 });
});

test("pantalla: cifras escapadas, botones con nombre, aviso de la previsión, lo que falta y modo automático", () => {
  const accounts = [
    { id: "caixa", label: "CaixaBank", known: { value: 970, date: "2026-10-02", source: "extracto" }, planDelta: -810 },
    { id: "mediolanum", label: "Media<b>", known: { value: null, date: "", source: "ninguno" }, planDelta: null },
  ];
  const out = pulse.renderHtml(pulse.buildModel({ accounts, answers: {}, today: "2026-10-04" }), { money: (value) => `${value} €` });
  assert.match(out, /970 €<\/span> <span class="e19-kpi-note">saldo final del extracto del 02\/10 \(hace 2 días\)/);
  assert.match(out, /esperaba que se moviera -810 €/);
  assert.match(out, /data-pulso-coincide="caixa" aria-label="Coincide: CaixaBank sigue en 970 €"/);
  assert.doesNotMatch(out, /data-pulso-coincide="mediolanum"/, "sin ningún saldo no se puede «Coincide»");
  assert.match(out, /Media&lt;b&gt;/);
  assert.match(out, /id="pulsoSaldosEstado" role="status"/);
  const half = pulse.renderHtml(pulse.buildModel({ accounts, answers: { caixa: "coincide" }, today: "2026-10-04" }));
  assert.match(half, /Coincide ✓/);
  assert.match(half, /Falta confirmar Media&lt;b&gt;: sin eso, la fecha de hoy no es la de todas las cuentas\./);
  const auto = pulse.renderHtml(pulse.buildModel({ accounts, mode: "auto", today: "2026-10-04" }));
  assert.match(auto, /Estás en «Auto por fecha»/);
  assert.match(auto, /data-pulso-manual/);
  assert.doesNotMatch(auto, /data-pulso-coincide/);
});

test("tiempos: solo segundos y recuentos (sin importes), los 20 últimos, mediana y % de «Coincide»", () => {
  let store = { times: [] };
  [12, 30, 18].forEach((seconds, index) => { store = pulse.recordTiming(store, { date: `2026-10-0${index + 1}`, seconds, coincided: index === 1 ? 2 : 1, corrected: index === 1 ? 0 : 1, caixa: 999 }); });
  assert.deepEqual(plain(store.times[0]), { date: "2026-10-01", seconds: 12, coincided: 1, corrected: 1 }, "lo que no es un tiempo o un recuento no se guarda");
  assert.deepEqual(pulse.summarizeTimings(store), { count: 3, medianSeconds: 18, coincideShare: 67 });
  for (let index = 0; index < 25; index += 1) store = pulse.recordTiming(store, { date: "2026-10-04", seconds: 5 });
  assert.equal(store.times.length, 20);
  assert.deepEqual(pulse.summarizeTimings({ times: "x" }), { count: 0, medianSeconds: null, coincideShare: null });
  assert.deepEqual(pulse.normalizeTimings({ times: [{ date: "mal", seconds: 3 }, { date: "2026-10-01", seconds: -1 }] }), { times: [] });
});

test("app.js: el pulso recibe el declarado (con fecha solo en modo manual), el extracto y las filas del motor diario", () => {
  const context = {
    globalThis: null,
    FinanceCanonicalBalancePulse: pulse,
    state: { balanceMode: "manual", balanceDate: "2026-09-28" },
    accountBalancesFromState: () => ({ caixa: 1000, mediolanum: 4200 }),
    baseData: { transactions: [{ date: "2026-10-02", amount: -30, balance: 970, account: "CaixaBank" }] },
    canonicalDailyEngineRuns: { active: { rows: [{ date: "2026-10-02", checking: 900, savings: 4200 }, { date: "2026-10-04", checking: 850, savings: 4200 }] } },
    isoLocalDate: () => "2026-10-04",
  };
  context.globalThis = context;
  vm.runInNewContext(`${extractFunction(app, "balancePulseAccounts")}\nthis.result = balancePulseAccounts();`, context);
  assert.deepEqual(plain(context.result), [
    { id: "caixa", label: "CaixaBank", known: { value: 970, date: "2026-10-02", source: "extracto" }, planDelta: -50 },
    { id: "mediolanum", label: "Mediolanum", known: { value: 4200, date: "2026-09-28", source: "declarado" }, planDelta: null },
  ]);
  context.state.balanceMode = "auto";
  vm.runInNewContext("this.result = balancePulseAccounts();", context);
  assert.equal(context.result[1].known.date, "", "en modo auto el saldo no es un dato declarado con fecha");
});

test("registro: el pulso encima de los saldos; motor y pantalla antes de app.js, offline y publicados; el panel de uso lo mide", () => {
  const panel = html.slice(html.indexOf('id="registrarBalancePanel"'), html.indexOf('id="registrarCaixaBalance"'));
  assert.match(panel, /<div class="pulso-saldos" id="pulsoSaldos" role="region" aria-label="Pulso de saldos"><\/div>/);
  ["canonical-balance-pulse.js", "registrar-ui.js"].forEach((file) => {
    const at = html.indexOf(`<script defer src="${file}?v=`);
    assert.ok(at > 0 && at < html.indexOf('<script defer src="app.js?v='), file);
    assert.match(read("service-worker.js"), new RegExp(`"\\./${file.replace(/\./g, "\\.")}",`));
    assert.match(read("tools/build-public-site.mjs"), new RegExp(`"${file.replace(/\./g, "\\.")}",`));
  });
  assert.match(extractFunction(app, "renderAccountBalancePanels"), /renderBalancePulse\(\); \/\/ WP-26/);
  assert.match(extractFunction(app, "renderRegistrarTabs"), /renderBalancePulse\(\);/);
  assert.match(app, /qs\(id\)\?\.addEventListener\("change", handleBalancePulseCorrection\);/);
  assert.match(app, /qs\("pulsoSaldos"\)\?\.addEventListener\("click", handleBalancePulseClick\);/);
  const ui = read("registrar-ui.js");
  assert.match(ui, /showUndoToast\("Saldos al día\.", [\s\S]*?, 8000\);/, "deshacer 8 s, como pide ND-01");
  assert.match(ui, /if \(seconds > 0 && seconds <= 600\)/, "una pantalla abierta 10 minutos no es un tiempo de actualizar");
  assert.match(ui, /parseAmountField\(event\.target\.value\) === null\) return;/, "un texto que no es importe no cuenta como «Corregir»");
  assert.match(read("usage-panel.js"), /metricRow\("Segundos para actualizar saldos"/);
});

test("el módulo es puro: sin DOM ni estado de la app", () => {
  assert.doesNotMatch(read("canonical-balance-pulse.js"), /\bwindow\b|\bdocument\b|\bbaseData\b|\blocalStorage\b|\bstate\./);
});
