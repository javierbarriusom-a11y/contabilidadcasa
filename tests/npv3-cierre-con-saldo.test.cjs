const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// WP-09 (NPV-03 / C2): el cierre de mes guarda el saldo de cada cuenta con su fecha y, del día 1 al 3,
// cierra el mes que ACABA (acuerdo del 2/10/2026: mes natural, cierre entre el 1 y el 3, saldo del último
// día). Sin tocar el RPC firmado `close_finance_month`: los saldos van a un almacén aparte que viaja con la
// copia y la nube, y solo se escriben si el RPC confirma el cierre.

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const engine = require("../canonical-month-close-balances.js");

// --- Motor puro --------------------------------------------------------------------------------

test("del 1 al 3 se cierra el mes que acaba; desde el 4, el mes en curso", () => {
  assert.equal(engine.closeTarget({ today: "2026-11-01" }).monthKey, "2026-10");
  assert.equal(engine.closeTarget({ today: "2026-11-03" }).monthKey, "2026-10");
  assert.equal(engine.closeTarget({ today: "2026-11-04" }).monthKey, "2026-11");
  assert.equal(engine.closeTarget({ today: "2027-01-02" }).monthKey, "2026-12", "enero cierra el diciembre del año anterior");
  assert.throws(() => engine.closeTarget({ today: "2026-11-31" }), /no es válida/);
});

test("la otra opción se ofrece solo si no está firmada, y se puede elegir", () => {
  const nothingSigned = engine.closeTarget({ today: "2026-11-02" });
  assert.deepEqual([nothingSigned.monthKey, nothingSigned.alternative, nothingSigned.isDefault], ["2026-10", "2026-11", true]);
  const currentChosen = engine.closeTarget({ today: "2026-11-02", choice: "2026-11" });
  assert.deepEqual([currentChosen.monthKey, currentChosen.alternative, currentChosen.isDefault], ["2026-11", "2026-10", false], "el mes de hoy sigue siendo posible");
  const late = engine.closeTarget({ today: "2026-11-15", choice: "2026-10" });
  assert.equal(late.monthKey, "2026-10", "cerrar tarde el mes anterior");
  assert.match(late.reason, /cerrar tarde/);
  const previousSigned = engine.closeTarget({ today: "2026-11-15", isSigned: (key) => key === "2026-10" });
  assert.equal(previousSigned.alternative, null, "un mes ya firmado no se ofrece");
  assert.equal(engine.closeTarget({ today: "2026-11-02", choice: "2026-07" }).monthKey, "2026-10", "solo el mes en curso o el anterior");
});

test("cada cierre guarda los saldos con su fecha y dice si son de fin de mes, de después o calculados", () => {
  const exact = engine.buildEntry({ monthKey: "2026-10", accounts: { caixabank: 1200.456, mediolanum: 300, efectivo: 50 }, date: "2026-10-31", closedAt: "2026-11-02T09:00:00Z" });
  assert.deepEqual(exact.accounts, { caixabank: 1200.46, mediolanum: 300, efectivo: 50 });
  assert.equal(exact.total, 1550.46);
  assert.equal(exact.offsetDays, 0);
  assert.equal(engine.describeDate(exact), "saldos del 31/10/2026, último día del mes");
  const after = engine.buildEntry({ monthKey: "2026-10", accounts: { caixabank: 1 }, date: "2026-11-02", closedAt: "" });
  assert.equal(after.offsetDays, 2);
  assert.equal(engine.describeDate(after), "saldos del 02/11/2026, 2 días después del fin de mes");
  const before = engine.buildEntry({ monthKey: "2026-02", accounts: { caixabank: 1 }, date: "2026-02-27", closedAt: "" });
  assert.equal(engine.describeDate(before), "saldos del 27/02/2026, 1 día antes del fin de mes");
  const auto = engine.buildEntry({ monthKey: "2026-10", accounts: { caixabank: 1 }, date: "2026-10-31", mode: "auto", closedAt: "" });
  assert.match(engine.describeDate(auto), /calculados por la app.*no los del banco/);
  assert.throws(() => engine.buildEntry({ monthKey: "2026-10", accounts: {}, date: "2026-10-31" }), /No hay saldos/);
  assert.throws(() => engine.buildEntry({ monthKey: "2026-10", accounts: { caixabank: 1 }, date: "31/10/2026" }), /fecha/);
  assert.deepEqual(engine.buildEntry({ monthKey: "2026-10", accounts: { caixabank: "x", mediolanum: 5 }, date: "2026-10-31" }).accounts, { mediolanum: 5 }, "lo que no es número no se guarda como cero");
});

test("reabrir y volver a cerrar sustituye la entrada del mes (idempotente), sin tocar los demás", () => {
  const first = engine.buildEntry({ monthKey: "2026-10", accounts: { caixabank: 100 }, date: "2026-10-31", closedAt: "a" });
  let store = engine.recordEntry(null, engine.buildEntry({ monthKey: "2026-09", accounts: { caixabank: 90 }, date: "2026-09-30", closedAt: "s" }));
  store = engine.recordEntry(store, first);
  store = engine.recordEntry(store, { ...first, accounts: { caixabank: 105 }, closedAt: "b" });
  assert.deepEqual(Object.keys(store.months), ["2026-09", "2026-10"]);
  assert.equal(store.months["2026-10"].accounts.caixabank, 105);
  assert.equal(store.months["2026-10"].revision, 2);
  assert.equal(store.months["2026-09"].revision, 1);
  assert.equal(engine.previousEntry(store, "2026-11").monthKey, "2026-10");
  assert.equal(engine.previousEntry(store, "2026-10").monthKey, "2026-09");
  assert.equal(engine.previousEntry(store, "2026-09"), null);
  assert.deepEqual(engine.normalizeStore({ months: { "2026-13": {}, "2026-08": { date: "2026-08-31", accounts: {} }, bad: 1 } }), { months: { "2026-08": { date: "2026-08-31", accounts: {} } } });
});

test("cuadre: saldo anterior + movimientos entre las dos fechas = saldo de cierre (avisa, no bloquea)", () => {
  const previous = { monthKey: "2026-09", accounts: { caixabank: 1000, mediolanum: 500, efectivo: 20 }, date: "2026-09-30", mode: "manual" };
  const current = { monthKey: "2026-10", accounts: { caixabank: 2150, mediolanum: 500, efectivo: 10 }, date: "2026-10-31", mode: "manual" };
  const entries = [
    { accountId: "caixabank", date: "2026-09-30", signedAmount: -999 }, // el mismo día del saldo anterior: ya estaba dentro
    { accountId: "caixabank", date: "2026-10-01", signedAmount: 2000 },
    { accountId: "caixabank", date: "2026-10-15", signedAmount: -850 },
    { accountId: "caixabank", date: "2026-10-15", signedAmount: -850, duplicateOf: "tx-1" },
    { accountId: "caixabank", date: "2026-11-01", signedAmount: -5000 }, // después del saldo de cierre
  ];
  const [caixa, mediolanum] = engine.continuity({ previous, current, transactions: entries });
  assert.deepEqual([caixa.status, caixa.opening, caixa.movements, caixa.expected, caixa.diff, caixa.count], ["cuadra", 1000, 1150, 2150, 0, 2]);
  assert.equal(mediolanum.status, "sin-movimientos", "Mediolanum no trae extracto: no se compara contra cero");
  assert.equal(engine.continuity({ previous, current, transactions: entries }).length, 2, "el efectivo no tiene extracto con el que cuadrar");
  const off = engine.continuity({ previous, current: { ...current, accounts: { caixabank: 2100 } }, transactions: entries })[0];
  assert.deepEqual([off.status, off.diff], ["descuadra", -50]);
  assert.equal(engine.continuity({ previous: null, current, transactions: entries })[0].status, "sin-cierre-anterior");
  assert.equal(engine.continuity({ previous: { ...previous, mode: "auto" }, current, transactions: entries })[0].status, "calculado");
  const raw = engine.continuity({ previous, current, transactions: [{ date: "2026-10-02", amount: 1150 }] })[0];
  assert.equal(raw.status, "cuadra", "movimientos sin cuenta son de CaixaBank, como en el libro; `amount` con signo también vale");
});

// --- app.js: el cierre usa el motor sin tocar el RPC -------------------------------------------

function extractFunction(name, source = app) {
  const start = source.indexOf(`async function ${name}(`) >= 0 ? source.indexOf(`async function ${name}(`) : source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, name);
  return source.slice(start, source.indexOf("\n}\n", start) + 2);
}

function wp09Block() {
  const start = app.indexOf("// WP-09 (C2): qué mes se cierra");
  return app.slice(start, app.indexOf("async function closeCurrentMonthTransaction()", start));
}

function loadClose({ today, rpcError = null, closures = [], balanceDate = "2026-10-31", balanceMode = "manual" }) {
  const storage = {};
  const calls = [];
  const sandbox = {
    console,
    window: {},
    storage,
    calls,
    monthClosures: closures,
    remoteUser: { email: "hogar@example.com" },
    remoteHeadSnapshotId: "head-1",
    supabaseClient: { rpc: async (name, args) => { calls.push({ name, args }); return { error: rpcError }; } },
    state: { balanceDate, balanceMode },
    balanceSettings: { efectivoBalance: 40 },
    statusEl: { textContent: "" },
  };
  vm.createContext(sandbox);
  vm.runInContext(read("canonical-month-close-balances.js"), sandbox);
  vm.runInContext(`
    window.FinanceCanonicalMonthCloseBalances = FinanceCanonicalMonthCloseBalances;
    window.FinanceCanonicalE5 = { latestMonthOperation: (payload, key) => payload.monthClosures.filter((item) => item.monthKey === key).at(-1) || null };
    window.FinanceCanonicalMonthClose = { closeMonth: (payload, month, meta) => ({ ...payload, monthClosures: [...payload.monthClosures, { monthKey: month, status: "closed", id: meta.id, closedAt: meta.closedAt }] }) };
    window.FinanceCanonicalSupabaseStore = { createUuid: (prefix) => prefix + "-id", fingerprintPayload: () => "fp" };
    function isoLocalDate() { return ${JSON.stringify(today)}; }
    function defaultBalanceDate() { return "2026-10-31"; }
    function storageKey(name) { return name + ":demo"; }
    function storageGet(key, fallback) { return key in storage ? storage[key] : fallback; }
    function storageSet(key, value) { storage[key] = value; }
    function accountBalancesFromState() { return { caixa: 1234.5, mediolanum: 600, total: 1834.5 }; }
    function qs(id) { return id === "monthCloseStatus" ? statusEl : null; }
    async function requestOperationConfirmation() { return { reason: "Mes revisado" }; }
    function monthCloseConfirmMessage() { return ""; }
    function pendingActualsForMonthKey() { return null; }
    function cuadroMandosAllMonths() { return []; }
    function sobresSettlementsForSign() { return []; }
    function appStatePayload() { return { monthClosures }; }
    function sourceStateKey() { return "demo"; }
    function ensureRemoteSaveQueue() { return { acknowledge() {} }; }
    let cierreSobresChoices = {};
    ${["recordCierreAprendizaje", "recalibrateForecastLearning", "recordPvc6ForecastSnapshot", "renderPvc6SnapshotOptions", "saveDebtCapitalSnapshotAtClose", "recordCierreReportArchive", "recordIv1ValuationSnapshot", "renderIv1ValuationHistoryNote", "saveLocalSnapshot", "refreshReconciliationView", "renderConciliar", "renderCierre"].map((name) => `function ${name}() {}`).join("\n")}
    function homeDebtOutlook() { return { pendingPrincipal: 0 }; }
    ${wp09Block()}
    ${extractFunction("closeCurrentMonthTransaction")}
    this.run = closeCurrentMonthTransaction;
    this.getState = () => ({ monthClosures, remoteHeadSnapshotId, closeTargetChoice });
    this.setChoice = (value) => { closeTargetChoice = value; };
  `, sandbox);
  return sandbox;
}

test("el 2 de noviembre se firma octubre y se guardan sus saldos, con el mismo RPC de siempre", async () => {
  const sandbox = loadClose({ today: "2026-11-02" });
  await sandbox.run();
  assert.equal(sandbox.calls.length, 1);
  assert.equal(sandbox.calls[0].name, "close_finance_month", "el mismo RPC firmado");
  assert.equal(sandbox.calls[0].args.p_month_key, "2026-10");
  const saved = JSON.parse(sandbox.storage["month-close-balances:demo"]).months["2026-10"];
  assert.deepEqual(saved.accounts, { caixabank: 1234.5, mediolanum: 600, efectivo: 40 });
  assert.equal(saved.date, "2026-10-31");
  assert.equal(saved.offsetDays, 0);
  assert.equal(saved.revision, 1);
  assert.match(sandbox.statusEl.textContent, /2026-10 cerrado.*Saldos guardados\./);
});

test("se puede elegir el mes de hoy aunque sea del 1 al 3; tras firmar, la pantalla sigue en el mes firmado", async () => {
  const sandbox = loadClose({ today: "2026-11-02" });
  sandbox.setChoice("2026-11");
  await sandbox.run();
  assert.equal(sandbox.calls[0].args.p_month_key, "2026-11");
  // La elección se mantiene (solo en memoria): la pantalla enseña el mes recién firmado, no salta a otro.
  assert.equal(sandbox.getState().closeTargetChoice, "2026-11");
});

test("un mes pasado sin firmar se puede firmar: «implícitamente cerrado» no es «firmado»", async () => {
  const sandbox = loadClose({ today: "2026-11-02" });
  await sandbox.run();
  assert.equal(sandbox.calls.length, 1, "octubre no tenía cierre firmado: se cierra");
  const signed = loadClose({ today: "2026-11-02", closures: [{ monthKey: "2026-10", status: "closed", id: "c1" }] });
  await signed.run();
  assert.equal(signed.calls.length, 0, "ya firmado: no se vuelve a cerrar");
  assert.match(signed.statusEl.textContent, /ya está cerrado/);
});

test("dos sesiones: si otra sesión publicó antes, el RPC lo rechaza y no se escribe ningún saldo ni se mueve el puntero", async () => {
  const sandbox = loadClose({ today: "2026-11-02", rpcError: new Error("Otra sesión publicó una revisión más reciente.") });
  await sandbox.run();
  assert.equal(sandbox.storage["month-close-balances:demo"], undefined);
  assert.equal(sandbox.getState().remoteHeadSnapshotId, "head-1");
  assert.equal(sandbox.getState().monthClosures.length, 0);
  assert.match(sandbox.statusEl.textContent, /No se cerró el mes: Otra sesión/);
});

test("reabrir y volver a cerrar: una sola entrada de saldos por mes, la última", async () => {
  const sandbox = loadClose({ today: "2026-11-02" });
  await sandbox.run();
  // Reapertura registrada (como la deja reopenLatestMonthTransaction) y nuevo cierre.
  vm.runInContext(`monthClosures = [...monthClosures, { monthKey: "2026-10", status: "reopened", id: "r1" }]; state.balanceDate = "2026-11-02";`, sandbox);
  await sandbox.run();
  const months = JSON.parse(sandbox.storage["month-close-balances:demo"]).months;
  assert.deepEqual(Object.keys(months), ["2026-10"]);
  assert.equal(months["2026-10"].revision, 2);
  assert.equal(months["2026-10"].date, "2026-11-02");
  assert.equal(months["2026-10"].offsetDays, 2);
});

test("sin saldos con fecha válida el cierre se firma igual y lo dice", async () => {
  const sandbox = loadClose({ today: "2026-11-02", balanceDate: "no-es-fecha" });
  await sandbox.run();
  assert.equal(sandbox.calls.length, 1);
  assert.equal(sandbox.storage["month-close-balances:demo"], undefined);
  assert.match(sandbox.statusEl.textContent, /Sin saldos guardados/);
});

test("registro: copia y nube, carga antes que app.js, caché offline y pantalla de Cierre", () => {
  assert.match(app, /"month-close-balances", \/\/ WP-09/);
  const html = read("index.html");
  const at = html.indexOf('<script defer src="canonical-month-close-balances.js?v=');
  assert.ok(at > 0 && at < html.indexOf('<script defer src="app.js?v='));
  assert.match(html, /<p class="e19-kpi-note" id="cierreTarget"><\/p>/);
  assert.match(read("service-worker.js"), /"\.\/canonical-month-close-balances\.js",/);
  assert.match(read("tools/build-public-site.mjs"), /"canonical-month-close-balances\.js",/);
  const close = extractFunction("closeCurrentMonthTransaction");
  assert.ok(close.indexOf("if (result.error) throw result.error;") < close.indexOf("recordMonthCloseBalances(month, closedAt)"), "los saldos se guardan solo tras el RPC");
  const cierre = read("views/cierre.js");
  assert.match(cierre, /const target = closeTargetInfo\(\);\n\s+const currentMonthKey = target\.monthKey;/);
  assert.match(cierre, /Saldos que se guardarán/);
  assert.match(app, /cierre: \{ src: "views\/cierre\.js\?v=20261004wp09a1"/);
  assert.match(app, /if \(event\.target\.id === "cierreTargetSwitch"\) handleCierreTargetSwitch\(event\.target\.dataset\.month\);/);
});
